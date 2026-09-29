import type { Request, Response, NextFunction } from "express";
import * as classService from "./class.service.js";
import { sendResponse } from "../../utils/response.js";
import { getClassSchema } from "./class.schema.js";

export const getClasses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search } = getClassSchema.parse(req.query);

    const result = await classService.getClasses(page, limit, search);

    return sendResponse(res, 200, true, "Classes retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getClassById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const academicClass = await classService.getClassById(req.params.id);

    if (!academicClass) {
      return sendResponse(res, 404, true, "Class not found");
    }

    return sendResponse(res, 200, true, "Class retrieved successfully", academicClass);
  } catch (error) {
    next(error);
  }
};

export const getClassBySlug = async (
  req: Request<{ subjectId: string; slug: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const academicClass = await classService.getClassBySlug(
      req.params.subjectId,
      req.params.slug,
    );

    if (!academicClass) {
      return sendResponse(res, 404, true, "Class not found");
    }

    return sendResponse(res, 200, true, "Class retrieved successfully", academicClass);
  } catch (error) {
    next(error);
  }
};

export const createClass = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const academicClass = await classService.createClass(req.body);

    return sendResponse(res, 201, true, "Class created successfully", academicClass);
  } catch (error) {
    next(error);
  }
};

export const updateClass = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const academicClass = await classService.updateClass(req.params.id, req.body);

    return sendResponse(res, 200, true, "Class updated successfully", academicClass);
  } catch (error) {
    next(error);
  }
};

export const deleteClass = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await classService.deleteClass(req.params.id);

    return sendResponse(res, 200, true, "Class deleted successfully");
  } catch (error) {
    next(error);
  }
};
