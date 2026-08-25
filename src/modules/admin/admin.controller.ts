import type { Request, Response, NextFunction } from "express";
import * as adminService from "./admin.service.js";
import { sendResponse } from "../../utils/response.js";
import { getAdminsSchema } from "./admin.schema.js";

export const getAdmins = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search } = getAdminsSchema.parse(req.query);

    const result = await adminService.getAdmins(page, limit, search);

    return sendResponse(
      res,
      200,
      true,
      "Admins retrieved successfully",
      result,
    );
  } catch (error) {
    next(error);
  }
};

export const getAdminById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const admin = await adminService.getAdminById(req.params.id);

    if (!admin) {
      return sendResponse(res, 404, true, "Admin not found");
    }

    return sendResponse(res, 200, true, "Admin retrieved successfully", admin);
  } catch (error) {
    next(error);
  }
};

export const createAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await adminService.createAdmin(req.body);

    return sendResponse(res, 201, true, "Admin created successfully", user);
  } catch (error) {
    next(error);
  }
};

export const updateAdmin = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await adminService.updateAdmin(req.params.id, req.body);

    return sendResponse(res, 200, true, "Admin updated successfully", user);
  } catch (error) {
    next(error);
  }
};

export const toggleStatus = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await adminService.toggleStatus(req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "Admin status updated successfully",
      user,
    );
  } catch (error) {
    next(error);
  }
};

export const deleteAdmin = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await adminService.deleteAdmin(req.params.id);

    return sendResponse(res, 200, true, "Admin deleted successfully");
  } catch (error) {
    next(error);
  }
};
