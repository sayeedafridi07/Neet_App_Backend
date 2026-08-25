import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import prisma from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

interface AdminAuthPayload {
  userId: string;
  type: "SUPER_ADMIN" | "ADMIN";
}

export const adminAuthMiddleware = async (
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
    ) as AdminAuthPayload;

    if (decoded.type !== "ADMIN" && decoded.type !== "SUPER_ADMIN") {
      throw new AppError(401, "Authentication failed");
    }

    const admin = await prisma.admin.findUnique({
      where: {
        id: decoded.userId,
      },
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

    req.user = admin;

    next();
  } catch (error) {
    next(error);
  }
};
