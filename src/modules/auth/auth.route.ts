import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  adminLogin,
  adminLogout,
  logout,
  sendOtp,
  verifyOtp,
  register,
  getMe,
} from "./auth.controller.js";
import {
  loginSchema,
  mobileSchema,
  otpSchema,
  registerSchema,
} from "./auth.schema.js";

const router = Router();

// ROUTE FOR ADMIN
router.post("/admin/login", validate(loginSchema), adminLogin);
router.post("/admin/logout", authMiddleware, allowRoles("ADMIN", "SUPER_ADMIN"), adminLogout);
router.get("/admin/me", authMiddleware, allowRoles("ADMIN", "SUPER_ADMIN"), getMe);

// ROUTE FOR USER
router.post("/send-otp", validate(mobileSchema), sendOtp);
router.post("/verify-otp", validate(otpSchema), verifyOtp);
router.post(
  "/register",
  validate(registerSchema),
  authMiddleware,
  allowRoles("STUDENT"),
  register,
);
router.post("/logout", authMiddleware, allowRoles("STUDENT"), logout);
router.get("/me", authMiddleware, allowRoles("STUDENT"), getMe);

export default router;
