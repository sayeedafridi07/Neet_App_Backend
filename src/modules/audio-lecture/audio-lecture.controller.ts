import type { Request, Response, NextFunction } from "express";
import * as audioLectureService from "./audio-lecture.service.js";
import { sendResponse } from "../../utils/response.js";
import { getAudioLecturesSchema } from "./audio-lecture.schema.js";
import {
  AUDIO_FIELD_NAME,
  IMAGE_FIELD_NAME,
  discardUploadedFiles,
  getUploadedFile,
} from "../../config/multer.js";

export const getAudioLectures = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, chapterId, classId, subjectId } =
      getAudioLecturesSchema.parse(req.query);

    // Students only see active lectures; admins see everything
    const isActive = req.auth?.type === "STUDENT" ? true : undefined;

    const result = await audioLectureService.getAudioLectures(
      page,
      limit,
      search,
      chapterId,
      classId,
      subjectId,
      isActive,
    );

    return sendResponse(res, 200, true, "Audio lectures retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getAudioLectureById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const audioLecture = await audioLectureService.getAudioLectureById(
      req.params.id,
      req.auth?.type === "STUDENT",
    );

    if (!audioLecture) {
      return sendResponse(res, 404, true, "Audio lecture not found");
    }

    return sendResponse(res, 200, true, "Audio lecture retrieved successfully", audioLecture);
  } catch (error) {
    next(error);
  }
};

export const createAudioLecture = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const audioLecture = await audioLectureService.createAudioLecture(
      req.body,
      getUploadedFile(req, AUDIO_FIELD_NAME),
      getUploadedFile(req, IMAGE_FIELD_NAME),
    );

    return sendResponse(res, 201, true, "Audio lecture created successfully", audioLecture);
  } catch (error) {
    await discardUploadedFiles(req);
    next(error);
  }
};

export const updateAudioLecture = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const audioLecture = await audioLectureService.updateAudioLecture(
      req.params.id,
      req.body,
      getUploadedFile(req, AUDIO_FIELD_NAME),
      getUploadedFile(req, IMAGE_FIELD_NAME),
    );

    return sendResponse(res, 200, true, "Audio lecture updated successfully", audioLecture);
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
    const audioLecture = await audioLectureService.toggleStatus(req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "Audio lecture status updated successfully",
      audioLecture,
    );
  } catch (error) {
    next(error);
  }
};

export const deleteAudioLecture = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await audioLectureService.deleteAudioLecture(req.params.id);

    return sendResponse(res, 200, true, "Audio lecture deleted successfully");
  } catch (error) {
    next(error);
  }
};
