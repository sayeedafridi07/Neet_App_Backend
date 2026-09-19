import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error.js";
import { sendResponse } from "../utils/response.js";

export const errorMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("❌ SERVER ERROR");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.error("📅 Time:", new Date().toISOString());
  console.error("📌 Method:", req.method);
  console.error("📌 URL:", req.originalUrl);
  console.error("📌 IP:", req.ip);

  if (Object.keys(req.params).length > 0) {
    console.error("📦 Params:", req.params);
  }

  if (Object.keys(req.query).length > 0) {
    console.error("🔍 Query:", req.query);
  }

  if (req.body && Object.keys(req.body).length > 0) {
    console.error("📨 Body:", req.body);
  }

  if (error instanceof AppError) {
    console.error("⚠️ AppError:", {
      statusCode: error.statusCode,
      message: error.message,
    });
  } else if (error instanceof Error) {
    console.error("⚠️ Error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  } else {
    console.error("⚠️ Unknown Error:", error);
  }

  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (error instanceof AppError) {
    return sendResponse(
      res,
      error.statusCode,
      false,
      error.message,
    );
  }

  return sendResponse(
    res,
    500,
    false,
    "Oops! Something went wrong.",
  );
};