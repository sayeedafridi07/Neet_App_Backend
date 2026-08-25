import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error.js";
import { sendResponse } from "../utils/response.js";

export const errorMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // console.error(error);

  if (error instanceof AppError) {
    return sendResponse(res, error.statusCode, false, error.message);
  }

  return sendResponse(res, 500, false, "Oops! Something went wrong.");
};
