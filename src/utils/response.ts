import type { Response } from "express";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: unknown | null;
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data: T | null = null,
  error: unknown | null = null,
) => {
  const response: ApiResponse<T> = {
    success,
    message,
    data,
    error,
  };

  return res.status(statusCode).json(response);
};