import { Router } from "express";

import { getActiveUsers, getOverview, getUserTrends } from "./dashboard.controller.js";
import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";

const router = Router();

router.use(adminAuthMiddleware, allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN));

router.get("/overview", getOverview);
router.get("/user-trends", getUserTrends);
router.get("/active-users", getActiveUsers);

export default router;
