import type { NextFunction, Request, Response } from "express";

import { sendResponse } from "../utils/response.js";

export const notFoundMiddleware = (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  return sendResponse(
    res,
    404,
    false,
    // `Route not found: ${req.method} ${req.originalUrl}`,
    "Route not found",
  );
};
