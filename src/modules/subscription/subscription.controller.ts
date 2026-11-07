import type { Request, Response, NextFunction } from "express";
import * as subscriptionService from "./subscription.service.js";
import { sendResponse } from "../../utils/response.js";
import { getSubscriptionPlansSchema } from "./subscription.schema.js";

// =============================================================================
// Subscription plans (admin)
// =============================================================================

export const getSubscriptionPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, isActive } = getSubscriptionPlansSchema.parse(req.query);

    const result = await subscriptionService.getSubscriptionPlans(page, limit, search, isActive);

    return sendResponse(res, 200, true, "Subscription plans retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPlanById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plan = await subscriptionService.getSubscriptionPlanById(req.params.id);

    return sendResponse(res, 200, true, "Subscription plan retrieved successfully", plan);
  } catch (error) {
    next(error);
  }
};

export const createSubscriptionPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plan = await subscriptionService.createSubscriptionPlan(req.body);

    return sendResponse(res, 201, true, "Subscription plan created successfully", plan);
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionPlan = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plan = await subscriptionService.updateSubscriptionPlan(req.params.id, req.body);

    return sendResponse(res, 200, true, "Subscription plan updated successfully", plan);
  } catch (error) {
    next(error);
  }
};

export const toggleStatus = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plan = await subscriptionService.toggleStatus(req.params.id);

    return sendResponse(res, 200, true, "Subscription plan status updated successfully", plan);
  } catch (error) {
    next(error);
  }
};

export const deleteSubscriptionPlan = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await subscriptionService.deleteSubscriptionPlan(req.params.id);

    return sendResponse(res, 200, true, "Subscription plan deleted successfully");
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// Checkout & payments (student)
// =============================================================================

export const checkout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await subscriptionService.checkout(req.user!.id, req.body);

    return sendResponse(res, 201, true, "Checkout created successfully", order);
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await subscriptionService.verifyPayment(req.user!.id, req.body);

    return sendResponse(res, 200, true, "Payment verified successfully", subscription);
  } catch (error) {
    next(error);
  }
};

export const getMySubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subscriptionService.getMySubscription(req.user!.id);

    return sendResponse(res, 200, true, "Subscription retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};
