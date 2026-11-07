import { z } from "zod";
import { formBoolean } from "../../utils/form.js";

// =============================================================================
// Subscription plans (admin)
// =============================================================================

// Amounts are in the smallest currency unit (paise)
const planFields = {
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  price: z.coerce.number().int().min(0, "Price cannot be negative"),
  originalPrice: z.coerce
    .number()
    .int()
    .min(0, "Original price cannot be negative")
    .nullable()
    .optional(),
  currency: z.string().trim().length(3, "Currency must be a 3-letter code").toUpperCase().optional(),
  durationDays: z.coerce.number().int().min(1, "Duration must be at least 1 day"),
  features: z.array(z.string().trim().min(1)).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isActive: formBoolean.optional(),
};

export const createSubscriptionPlanSchema = z
  .object(planFields)
  .refine(
    (data) => data.originalPrice == null || data.originalPrice >= data.price,
    { message: "Original price must be greater than or equal to price", path: ["originalPrice"] },
  );

export const updateSubscriptionPlanSchema = z
  .object(planFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const getSubscriptionPlansSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  isActive: formBoolean.optional(),
});

// =============================================================================
// Checkout & payments (student)
// =============================================================================

export const checkoutSchema = z.object({
  planId: z.uuid("Invalid plan ID"),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1, "Order ID is required"),
  razorpayPaymentId: z.string().trim().min(1, "Payment ID is required"),
  razorpaySignature: z.string().trim().min(1, "Signature is required"),
});

export type CreateSubscriptionPlanData = z.infer<typeof createSubscriptionPlanSchema>;
export type UpdateSubscriptionPlanData = z.infer<typeof updateSubscriptionPlanSchema>;
export type CheckoutData = z.infer<typeof checkoutSchema>;
export type VerifyPaymentData = z.infer<typeof verifyPaymentSchema>;
