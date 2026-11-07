import type { Request, Response, NextFunction } from "express";
import * as dashboardService from "./dashboard.service.js";
import { sendResponse } from "../../utils/response.js";
import { activeUsersQuerySchema, userTrendsQuerySchema } from "./dashboard.schema.js";

export const getOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dashboardService.getOverview();
    return sendResponse(res, 200, true, "Dashboard overview retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getUserTrends = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year } = userTrendsQuerySchema.parse(req.query);
    const result = await dashboardService.getUserTrends(year);
    return sendResponse(res, 200, true, "User trends retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getActiveUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days, inactiveAfterDays } = activeUsersQuerySchema.parse(req.query);
    const result = await dashboardService.getActiveUsers(days, inactiveAfterDays);
    return sendResponse(res, 200, true, "Active users retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};
