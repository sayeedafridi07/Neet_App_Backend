import type { Request, Response, NextFunction } from "express";
import * as keywordRevisionService from "./keyword-revision.service.js";
import { sendResponse } from "../../utils/response.js";
import { getKeywordRevisionsSchema } from "./keyword-revision.schema.js";
import { discardUploadedFile } from "../../config/multer.js";

export const getKeywordRevisions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, chapterId, isActive } =
      getKeywordRevisionsSchema.parse(req.query);

    const result = await keywordRevisionService.getKeywordRevisions(
      page,
      limit,
      search,
      chapterId,
      isActive,
    );

    return sendResponse(res, 200, true, "Keyword revisions retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getKeywordRevisionById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const keywordRevision = await keywordRevisionService.getKeywordRevisionById(req.params.id);

    if (!keywordRevision) {
      return sendResponse(res, 404, true, "Keyword revision not found");
    }

    return sendResponse(res, 200, true, "Keyword revision retrieved successfully", keywordRevision);
  } catch (error) {
    next(error);
  }
};

export const getKeywordRevisionBySlug = async (
  req: Request<{ chapterId: string; slug: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const keywordRevision = await keywordRevisionService.getKeywordRevisionBySlug(
      req.params.chapterId,
      req.params.slug,
    );

    if (!keywordRevision) {
      return sendResponse(res, 404, true, "Keyword revision not found");
    }

    return sendResponse(res, 200, true, "Keyword revision retrieved successfully", keywordRevision);
  } catch (error) {
    next(error);
  }
};

export const createKeywordRevision = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const keywordRevision = await keywordRevisionService.createKeywordRevision(
      req.body,
      req.file,
    );

    return sendResponse(res, 201, true, "Keyword revision created successfully", keywordRevision);
  } catch (error) {
    await discardUploadedFile(req.file);
    next(error);
  }
};

export const updateKeywordRevision = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const keywordRevision = await keywordRevisionService.updateKeywordRevision(
      req.params.id,
      req.body,
      req.file,
    );

    return sendResponse(res, 200, true, "Keyword revision updated successfully", keywordRevision);
  } catch (error) {
    await discardUploadedFile(req.file);
    next(error);
  }
};

export const deleteKeywordRevision = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await keywordRevisionService.deleteKeywordRevision(req.params.id);

    return sendResponse(res, 200, true, "Keyword revision deleted successfully");
  } catch (error) {
    next(error);
  }
};
