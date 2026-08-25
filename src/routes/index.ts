import { Router } from "express";

import userRoutes from "../modules/user/user.route.js";
import authRoutes from "../modules/auth/auth.route.js";
import adminRoutes from "../modules/admin/admin.route.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/admins", adminRoutes);

export default router;
