import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import prisma from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

interface UserAuthPayload {
  userId: string;
  type: "STUDENT";
}

export const userAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const deviceId = req.headers["x-device-id"];

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
    ) as UserAuthPayload;

    if (decoded.type !== "STUDENT") {
      throw new AppError(401, "Authentication failed");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
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

    if (user.deviceId && user.deviceId !== deviceId) {
      throw new AppError(401, "Unauthorized device detected");
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};
