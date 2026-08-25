import { Router } from "express";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
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
import { userAuthMiddleware } from "../../middlewares/user-auth.middleware.js";

const router = Router();

// ROUTE FOR ADMIN
router.post("/admin/login", validate(loginSchema), adminLogin);
router.post("/admin/logout", adminAuthMiddleware, adminLogout);
router.get("/admin/me", adminAuthMiddleware, getMe);

// ROUTE FOR USER
router.post("/send-otp", validate(mobileSchema), sendOtp);
router.post("/verify-otp", validate(otpSchema), verifyOtp);
router.post(
  "/register",
  validate(registerSchema),
  userAuthMiddleware,
  register,
);
router.post("/logout", userAuthMiddleware, logout);
router.get("/me", userAuthMiddleware, getMe);

export default router;
