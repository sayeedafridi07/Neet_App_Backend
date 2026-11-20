import type { Request, Response, NextFunction } from "express";
import * as keywordRevisionService from "./keyword-revision.service.js";
import { sendResponse } from "../../utils/response.js";
import {
  getKeywordRevisionsSchema,
  getStudentKeywordRevisionsSchema,
  importKeywordRevisionsSchema,
} from "./keyword-revision.schema.js";
import { AppError } from "../../utils/app-error.js";
import {
  AUDIO_FIELD_NAME,
  IMAGE_FIELD_NAME,
  discardUploadedFiles,
  getDocumentKind,
  getUploadedFile,
} from "../../config/multer.js";

export const getKeywordRevisions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, chapterId, classId, subjectId } =
      getKeywordRevisionsSchema.parse(req.query);

    // Students only see active keyword revisions; admins see everything
    const isActive = req.auth?.type === "STUDENT" ? true : undefined;

    const result = await keywordRevisionService.getKeywordRevisions(
      page,
      limit,
      search,
      chapterId,
      classId,
      subjectId,
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
    const keywordRevision = await keywordRevisionService.getKeywordRevisionById(
      req.params.id,
      req.auth?.type === "STUDENT",
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
      getUploadedFile(req, AUDIO_FIELD_NAME),
      getUploadedFile(req, IMAGE_FIELD_NAME),
    );

    return sendResponse(res, 201, true, "Keyword revision created successfully", keywordRevision);
  } catch (error) {
    await discardUploadedFiles(req);
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
      getUploadedFile(req, AUDIO_FIELD_NAME),
      getUploadedFile(req, IMAGE_FIELD_NAME),
    );

    return sendResponse(res, 200, true, "Keyword revision updated successfully", keywordRevision);
  } catch (error) {
    await discardUploadedFiles(req);
    next(error);
  }
};

export const toggleStatus = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const keywordRevision = await keywordRevisionService.toggleStatus(req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "Keyword revision status updated successfully",
      keywordRevision,
    );
  } catch (error) {
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

export const getStudentKeywordRevisions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { classId, subjectId } = getStudentKeywordRevisionsSchema.parse(
      req.query,
    );

    const chapters = await keywordRevisionService.getStudentKeywordRevisions(
      classId,
      subjectId,
    );

    return sendResponse(
      res,
      200,
      true,
      "Keyword revisions retrieved successfully",
      chapters,
    );
  } catch (error) {
    next(error);
  }
};

export const importKeywordRevisions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'Upload a .xlsx file as "file"');
    }

    if (getDocumentKind(req.file.mimetype, req.file.originalname) !== "xlsx") {
      throw new AppError(415, "Only .xlsx files are supported");
    }

    const { chapterId } = importKeywordRevisionsSchema.parse(req.body);

    const result = await keywordRevisionService.importKeywordRevisions(
      chapterId,
      req.file.buffer,
    );

    return sendResponse(
      res,
      201,
      true,
      result.skipped.length
        ? `${result.imported} of ${result.total} keyword(s) imported, ${result.skipped.length} skipped`
        : `${result.imported} of ${result.total} keyword(s) imported successfully`,
      result,
    );
  } catch (error) {
    next(error);
  }
};
