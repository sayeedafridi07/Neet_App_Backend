import crypto from "node:crypto";

import prisma from "../../config/prisma.js";
import razorpay from "../../config/razorpay.js";
import { AppError } from "../../utils/app-error.js";

import type {
  CheckoutData,
  CreateSubscriptionPlanData,
  UpdateSubscriptionPlanData,
  VerifyPaymentData,
} from "./subscription.schema.js";

// =============================================================================
// Subscription plans (admin)
// =============================================================================

const findPlanOrThrow = async (id: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });

  if (!plan) {
    throw new AppError(404, "Subscription plan not found");
  }

  return plan;
};

export const getSubscriptionPlans = async (
  page: number,
  limit: number,
  search?: string,
  isActive?: boolean,
) => {
  const skip = (page - 1) * limit;

  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [plans, total] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    }),
    prisma.subscriptionPlan.count({ where }),
  ]);

  return {
    plans,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getSubscriptionPlanById = async (id: string) => {
  return findPlanOrThrow(id);
};

export const createSubscriptionPlan = async (
  data: CreateSubscriptionPlanData,
) => {
  return prisma.subscriptionPlan.create({ data });
};

export const updateSubscriptionPlan = async (
  id: string,
  data: UpdateSubscriptionPlanData,
) => {
  const plan = await findPlanOrThrow(id);

  const price = data.price ?? plan.price;
  const originalPrice =
    data.originalPrice === undefined ? plan.originalPrice : data.originalPrice;

  if (originalPrice != null && originalPrice < price) {
    throw new AppError(
      400,
      "Original price must be greater than or equal to price",
    );
  }

  return prisma.subscriptionPlan.update({
    where: { id },
    data,
  });
};

export const toggleStatus = async (id: string) => {
  const plan = await findPlanOrThrow(id);

  return prisma.subscriptionPlan.update({
    where: { id },
    data: { isActive: !plan.isActive },
  });
};

export const deleteSubscriptionPlan = async (id: string) => {
  await findPlanOrThrow(id);

  const subscriptionCount = await prisma.subscription.count({
    where: { planId: id },
  });

  if (subscriptionCount > 0) {
    throw new AppError(
      409,
      "This plan has subscriptions and cannot be deleted. Deactivate it instead.",
    );
  }

  await prisma.subscriptionPlan.delete({ where: { id } });
};

// =============================================================================
// Checkout & payments (student)
// =============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

export const checkout = async (userId: string, { planId }: CheckoutData) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId, isActive: true },
  });

  if (!plan) {
    throw new AppError(404, "Subscription plan not found");
  }

  const order = await razorpay.orders.create({
    amount: plan.price,
    currency: plan.currency,
    // Razorpay caps receipts at 40 characters
    receipt: `sub_${Date.now()}`,
    notes: { userId, planId },
  });

  const { createdAt, updatedAt, ...planSnapshot } = plan;

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId,
      planSnapshot,
      payments: {
        create: {
          userId,
          amount: plan.price,
          currency: plan.currency,
          providerOrderId: order.id,
        },
      },
    },
  });

  return {
    subscriptionId: subscription.id,
    orderId: order.id,
    amount: plan.price,
    currency: plan.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    plan: { id: plan.id, name: plan.name, durationDays: plan.durationDays },
  };
};

const isValidSignature = (
  orderId: string,
  paymentId: string,
  signature: string,
) => {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const verifyPayment = async (
  userId: string,
  { razorpayOrderId, razorpayPaymentId, razorpaySignature }: VerifyPaymentData,
) => {
  const payment = await prisma.payment.findUnique({
    where: { providerOrderId: razorpayOrderId },
    include: { subscription: true },
  });

  if (!payment || payment.userId !== userId) {
    throw new AppError(404, "Payment not found");
  }

  // Verifying twice returns the same result instead of failing
  if (payment.status === "SUCCESS") {
    return payment.subscription;
  }

  if (payment.status !== "CREATED") {
    throw new AppError(400, "This payment can no longer be verified");
  }

  if (
    !isValidSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
  ) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        providerPaymentId: razorpayPaymentId,
        failureReason: "Invalid payment signature",
      },
    });

    throw new AppError(400, "Payment verification failed");
  }

  const durationDays = (
    payment.subscription.planSnapshot as { durationDays: number }
  ).durationDays;

  return prisma.$transaction(async (tx) => {
    // Guards against two verify calls racing each other
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "CREATED" },
      data: {
        status: "SUCCESS",
        providerPaymentId: razorpayPaymentId,
        providerSignature: razorpaySignature,
        paidAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      return tx.subscription.findUniqueOrThrow({
        where: { id: payment.subscriptionId },
      });
    }

    // A renewal bought before expiry starts when the current access ends
    const now = new Date();
    const latest = await tx.subscription.findFirst({
      where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
    });

    const startsAt = latest?.expiresAt ?? now;
    const expiresAt = new Date(startsAt.getTime() + durationDays * DAY_MS);

    return tx.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: "ACTIVE", startsAt, expiresAt },
    });
  });
};

export const getMySubscription = async (userId: string) => {
  const now = new Date();

  const subscriptions = await prisma.subscription.findMany({
    where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      status: true,
      startsAt: true,
      expiresAt: true,
      planSnapshot: true,
      createdAt: true,
    },
  });

  const current = subscriptions.find((sub) => sub.startsAt! <= now) ?? null;
  const upcoming = subscriptions.filter((sub) => sub !== current);

  return {
    isSubscribed: current !== null,
    current,
    upcoming,
    // When all purchased access runs out, including renewals
    accessExpiresAt: subscriptions.at(-1)?.expiresAt ?? null,
  };
};
