import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";
import type { AuthType } from "./auth.middleware.js";

export const allowRoles = (...allowedRoles: AuthType[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new AppError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(req.auth.type)) {
      return next(new AppError(403, "Access denied"));
    }

    next();
  };
};