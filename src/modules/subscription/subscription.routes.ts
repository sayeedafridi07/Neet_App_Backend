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

import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
import { userAuthMiddleware } from "../../middlewares/user-auth.middleware.js";
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

router.post("/checkout", userAuthMiddleware, validate(checkoutSchema), checkout);
router.post("/verify-payment", userAuthMiddleware, validate(verifyPaymentSchema), verifyPayment);
router.get("/me", userAuthMiddleware, getMySubscription);

// =============================================================================
// Subscription plans (admin)
// =============================================================================

const admin = [adminAuthMiddleware, allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)];

router.get("/plans", ...admin, getSubscriptionPlans);
router.get("/plans/:id", ...admin, getSubscriptionPlanById);
router.post("/plans", ...admin, validate(createSubscriptionPlanSchema), createSubscriptionPlan);
router.patch("/plans/:id", ...admin, validate(updateSubscriptionPlanSchema), updateSubscriptionPlan);
router.patch("/plans/:id/status", ...admin, toggleStatus);
router.delete("/plans/:id", ...admin, allowRoles(AdminRole.SUPER_ADMIN), deleteSubscriptionPlan);

export default router;
