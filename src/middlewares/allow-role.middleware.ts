import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";

export const allowRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      throw new AppError(403, "Access denied");
    }

    next();
  };
};
