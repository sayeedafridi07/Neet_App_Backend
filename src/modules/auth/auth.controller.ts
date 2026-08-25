import type { NextFunction, Request, Response } from "express";
import { sendResponse } from "../../utils/response.js";
import * as authService from "./auth.service.js";

export const adminLogin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    const result = await authService.adminLogin(email, password);

    return sendResponse(res, 200, true, "Logged in successfully", result);
  } catch (error) {
    next(error);
  }
};

export const adminLogout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.adminLogout(req.user?.id as string);
    return sendResponse(res, 200, true, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.logout(req.user?.id as string);
    return sendResponse(res, 200, true, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

export const sendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { phone } = req.body;

    await authService.sendOtp(phone);

    return sendResponse(res, 200, true, "OTP sent successfully");
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { phone, otp } = req.body;
    const deviceId = req.headers["x-device-id"] as string;
    const result = await authService.verifyOtp(phone, otp, deviceId);

    return sendResponse(res, 200, true, "OTP verified successfully", result);
  } catch (error) {
    next(error);
  }
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, targetYear, city, schoolName } = req.body;
    const deviceId = req.headers["x-device-id"] as string;
    const userId = req.user?.id as string;

    const result = await authService.register(
      userId,
      name,
      targetYear,
      city,
      schoolName,
      deviceId,
    );

    return sendResponse(res, 201, true, "User registered successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;

    return sendResponse(res, 200, true, "User profile fetched successfully", {
      id: user.id,
      phone: user.phone,
      name: user.name,
      targetYear: user.targetYear,
      city: user.city,
      schoolName: user.schoolName,
      profileComplete: user.profileComplete,
    });
  } catch (error) {
    next(error);
  }
};
