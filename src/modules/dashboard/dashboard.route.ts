import { Router } from "express";

import { getActiveUsers, getOverview, getUserTrends } from "./dashboard.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";

const router = Router();

router.use(authMiddleware, allowRoles("ADMIN", "SUPER_ADMIN"));

router.get("/overview", getOverview);
router.get("/user-trends", getUserTrends);
router.get("/active-users", getActiveUsers);

export default router;
