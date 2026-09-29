import type { Request, Response, NextFunction } from "express";
import * as chapterService from "./chapter.service.js";
import { sendResponse } from "../../utils/response.js";
import { getChapterSchema } from "./chapter.schema.js";

export const getChapters = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, classId } = getChapterSchema.parse(req.query);

    const result = await chapterService.getChapters(page, limit, search, classId);

    return sendResponse(res, 200, true, "Chapters retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getChapterById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const chapter = await chapterService.getChapterById(req.params.id);

    if (!chapter) {
      return sendResponse(res, 404, true, "Chapter not found");
    }

    return sendResponse(res, 200, true, "Chapter retrieved successfully", chapter);
  } catch (error) {
    next(error);
  }
};

export const getChapterBySlug = async (
  req: Request<{ classId: string; slug: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const chapter = await chapterService.getChapterBySlug(
      req.params.classId,
      req.params.slug,
    );

    if (!chapter) {
      return sendResponse(res, 404, true, "Chapter not found");
    }

    return sendResponse(res, 200, true, "Chapter retrieved successfully", chapter);
  } catch (error) {
    next(error);
  }
};

export const createChapter = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const chapter = await chapterService.createChapter(req.body);

    return sendResponse(res, 201, true, "Chapter created successfully", chapter);
  } catch (error) {
    next(error);
  }
};

export const updateChapter = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const chapter = await chapterService.updateChapter(req.params.id, req.body);

    return sendResponse(res, 200, true, "Chapter updated successfully", chapter);
  } catch (error) {
    next(error);
  }
};

export const deleteChapter = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await chapterService.deleteChapter(req.params.id);

    return sendResponse(res, 200, true, "Chapter deleted successfully");
  } catch (error) {
    next(error);
  }
};
