import type { Request, Response, NextFunction } from "express";
import * as subjectService from "./subject.service.js";
import { sendResponse } from "../../utils/response.js";
import { getSubjectsSchema } from "./subject.schema.js";

export const getSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search } = getSubjectsSchema.parse(req.query);

    const result = await subjectService.getSubjects(page, limit, search);

    return sendResponse(res, 200, true, "Subjects retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getSubjectById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.getSubjectById(req.params.id);

    if (!subject) {
      return sendResponse(res, 404, true, "Subject not found");
    }

    return sendResponse(res, 200, true, "Subject retrieved successfully", subject);
  } catch (error) {
    next(error);
  }
};

export const getSubjectBySlug = async (
  req: Request<{ slug: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.getSubjectBySlug(req.params.slug);

    if (!subject) {
      return sendResponse(res, 404, true, "Subject not found");
    }

    return sendResponse(res, 200, true, "Subject retrieved successfully", subject);
  } catch (error) {
    next(error);
  }
};

export const createSubject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.createSubject(req.body);

    return sendResponse(res, 201, true, "Subject created successfully", subject);
  } catch (error) {
    next(error);
  }
};

export const updateSubject = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.updateSubject(req.params.id, req.body);

    return sendResponse(res, 200, true, "Subject updated successfully", subject);
  } catch (error) {
    next(error);
  }
};

export const deleteSubject = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await subjectService.deleteSubject(req.params.id);

    return sendResponse(res, 200, true, "Subject deleted successfully");
  } catch (error) {
    next(error);
  }
};
