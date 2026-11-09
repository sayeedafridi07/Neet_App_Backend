import { Router } from "express";

import {
  getSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  toggleStatus,
  deleteSubscriptionPlan,
  checkout,
  verifyPayment,
  getMySubscription,
} from "./subscription.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  checkoutSchema,
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  verifyPaymentSchema,
} from "./subscription.schema.js";

const router = Router();

// =============================================================================
// Checkout & payments (student)
// =============================================================================

router.post("/checkout", authMiddleware, allowRoles("STUDENT"), validate(checkoutSchema), checkout);
router.post("/verify-payment", authMiddleware, allowRoles("STUDENT"), validate(verifyPaymentSchema), verifyPayment);
router.get("/me", authMiddleware, allowRoles("STUDENT"), getMySubscription);

// =============================================================================
// Subscription plans (admin)
// =============================================================================

const admin = [authMiddleware, allowRoles("ADMIN", "SUPER_ADMIN")];

router.get("/plans", ...admin, getSubscriptionPlans);
router.get("/plans/:id", ...admin, getSubscriptionPlanById);
router.post("/plans", ...admin, validate(createSubscriptionPlanSchema), createSubscriptionPlan);
router.patch("/plans/:id", ...admin, validate(updateSubscriptionPlanSchema), updateSubscriptionPlan);
router.patch("/plans/:id/status", ...admin, toggleStatus);
router.delete("/plans/:id", ...admin, allowRoles("SUPER_ADMIN"), deleteSubscriptionPlan);

export default router;
