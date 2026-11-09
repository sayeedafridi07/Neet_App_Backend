
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import prisma from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { trackUserActivity } from "../utils/activity.js";

export type AuthType = "STUDENT" | "ADMIN" | "SUPER_ADMIN";

interface AuthPayload {
  userId: string;
  type: AuthType;
}

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError(401, "Authorization header missing");
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError(401, "Invalid authorization header format");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!,
    ) as AuthPayload;

    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.userId !== "string" ||
      !["STUDENT", "ADMIN", "SUPER_ADMIN"].includes(decoded.type)
    ) {
      throw new AppError(401, "Invalid authentication token");
    }

    if (decoded.type === "STUDENT") {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new AppError(401, "User not found");
      }

      if (!user.isActive) {
        throw new AppError(401, "Account disabled");
      }

      if (user.accessToken !== token) {
        throw new AppError(401, "Session expired");
      }

      const deviceId = req.headers["x-device-id"];

      if (user.deviceId && user.deviceId !== deviceId) {
        throw new AppError(401, "Unauthorized device detected");
      }

      req.user = user;

      req.auth = {
        userId: user.id,
        type: "STUDENT",
      };

      trackUserActivity(user.id);
    } else {
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.userId },
      });

      if (!admin) {
        throw new AppError(401, "Admin not found");
      }

      if (!admin.isActive) {
        throw new AppError(401, "Account disabled");
      }

      if (admin.accessToken !== token) {
        throw new AppError(401, "Session expired");
      }

      if (admin.role !== decoded.type) {
        throw new AppError(401, "Authentication failed");
      }

      req.user = admin;

      req.auth = {
        userId: admin.id,
        type: admin.role,
      };
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, "Session expired"));
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, "Invalid authentication token"));
    }

    next(error);
  }
};
