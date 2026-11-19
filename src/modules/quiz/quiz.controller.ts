import type { Request, Response, NextFunction } from "express";
import * as quizService from "./quiz.service.js";
import * as attemptService from "./quiz-attempt.service.js";
import { sendResponse } from "../../utils/response.js";
import { AppError } from "../../utils/app-error.js";
import { getDocumentKind } from "../../config/multer.js";
import { getQuizzesSchema, getQuestionsSchema } from "./quiz.schema.js";
import {
  EXPLANATION_IMAGE_FIELD_NAME,
  IMAGE_FIELD_NAME,
  MAX_QUESTION_OPTIONS,
  getOptionImageFieldName,
  getUploadedFile,
} from "../../config/multer.js";

const getQuestionImages = (req: Request): quizService.QuestionImages => ({
  image: getUploadedFile(req, IMAGE_FIELD_NAME),
  explanationImage: getUploadedFile(req, EXPLANATION_IMAGE_FIELD_NAME),
  optionImages: Array.from({ length: MAX_QUESTION_OPTIONS }, (_, index) =>
    getUploadedFile(req, getOptionImageFieldName(index)),
  ),
});

const isStudent = (req: Request) => req.auth?.type === "STUDENT";

export const getQuizzes = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, chapterId, classId, subjectId } =
      getQuizzesSchema.parse(req.query);

    // Students only see active quizzes; admins see everything
    const isActive = isStudent(req) ? true : undefined;

    const result = await quizService.getQuizzes(
      page,
      limit,
      search,
      chapterId,
      classId,
      subjectId,
      isActive,
    );

    return sendResponse(
      res,
      200,
      true,
      "Quizzes retrieved successfully",
      result,
    );
  } catch (error) {
    next(error);
  }
};

export const getQuizById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quiz = await quizService.getQuizById(req.params.id, isStudent(req));

    return sendResponse(res, 200, true, "Quiz retrieved successfully", quiz);
  } catch (error) {
    next(error);
  }
};

export const createQuiz = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quiz = await quizService.createQuiz(req.body);

    return sendResponse(res, 201, true, "Quiz created successfully", quiz);
  } catch (error) {
    next(error);
  }
};

export const updateQuiz = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quiz = await quizService.updateQuiz(req.params.id, req.body);

    return sendResponse(res, 200, true, "Quiz updated successfully", quiz);
  } catch (error) {
    next(error);
  }
};

export const deleteQuiz = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await quizService.deleteQuiz(req.params.id);

    return sendResponse(res, 200, true, "Quiz deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const getQuestions = async (
  req: Request<{ quizId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search } = getQuestionsSchema.parse(req.query);

    // Students only see active questions; admins see everything
    const isActive = isStudent(req) ? true : undefined;

    const result = await quizService.getQuestions(
      req.params.quizId,
      page,
      limit,
      search,
      isActive,
    );

    return sendResponse(
      res,
      200,
      true,
      "Questions retrieved successfully",
      result,
    );
  } catch (error) {
    next(error);
  }
};

export const getQuestionById = async (
  req: Request<{ quizId: string; questionId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const question = await quizService.getQuestionById(
      req.params.quizId,
      req.params.questionId,
      isStudent(req),
    );

    return sendResponse(
      res,
      200,
      true,
      "Question retrieved successfully",
      question,
    );
  } catch (error) {
    next(error);
  }
};

export const createQuestion = async (
  req: Request<{ quizId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const question = await quizService.createQuestion(
      req.params.quizId,
      req.body,
      getQuestionImages(req),
    );

    return sendResponse(
      res,
      201,
      true,
      "Question created successfully",
      question,
    );
  } catch (error) {
    next(error);
  }
};

export const importQuestions = async (
  req: Request<{ quizId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'Upload a .docx or .xlsx file as "file"');
    }

    const result = await quizService.importQuestions(
      req.params.quizId,
      req.file.buffer,
      getDocumentKind(req.file.mimetype, req.file.originalname) ?? "docx",
    );

    return sendResponse(
      res,
      201,
      true,
      result.skipped.length
        ? `${result.imported} of ${result.total} question(s) imported, ${result.skipped.length} skipped`
        : `${result.imported} of ${result.total} question(s) imported successfully`,
      result,
    );
  } catch (error) {
    next(error);
  }
};

export const updateQuestion = async (
  req: Request<{ quizId: string; questionId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const question = await quizService.updateQuestion(
      req.params.quizId,
      req.params.questionId,
      req.body,
      getQuestionImages(req),
    );

    return sendResponse(
      res,
      200,
      true,
      "Question updated successfully",
      question,
    );
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (
  req: Request<{ quizId: string; questionId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await quizService.deleteQuestion(req.params.quizId, req.params.questionId);

    return sendResponse(res, 200, true, "Question deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const getOptions = async (
  req: Request<{ quizId: string; questionId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const question = await quizService.getQuestionById(
      req.params.quizId,
      req.params.questionId,
    );

    return sendResponse(
      res,
      200,
      true,
      "Options retrieved successfully",
      question?.options || [],
    );
  } catch (error) {
    next(error);
  }
};

export const deleteOption = async (
  req: Request<{ quizId: string; questionId: string; optionId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await (quizService as any).deleteOption?.(
      req.params.quizId,
      req.params.questionId,
      req.params.optionId,
    );

    return sendResponse(res, 200, true, "Option deleted successfully");
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/* ATTEMPTS (student)                                                         */
/* -------------------------------------------------------------------------- */

const getUserId = (req: Request) => {
  if (!req.auth) {
    throw new AppError(401, "Authentication required");
  }

  return req.auth.userId;
};

export const startQuiz = async (
  req: Request<{ quizId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await attemptService.startQuiz(
      req.params.quizId,
      getUserId(req),
    );

    return sendResponse(
      res,
      result.resumed ? 200 : 201,
      true,
      result.resumed ? "Quiz resumed successfully" : "Quiz started successfully",
      result,
    );
  } catch (error) {
    next(error);
  }
};

export const getMyAttempts = async (
  req: Request<{ quizId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const attempts = await attemptService.getMyAttempts(
      req.params.quizId,
      getUserId(req),
    );

    return sendResponse(res, 200, true, "Attempts retrieved successfully", attempts);
  } catch (error) {
    next(error);
  }
};

export const saveAnswer = async (
  req: Request<{ attemptId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const answer = await attemptService.saveAnswer(
      req.params.attemptId,
      getUserId(req),
      req.body,
    );

    return sendResponse(res, 200, true, "Answer saved successfully", answer);
  } catch (error) {
    next(error);
  }
};

export const submitQuiz = async (
  req: Request<{ attemptId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await attemptService.submitQuiz(
      req.params.attemptId,
      getUserId(req),
    );

    return sendResponse(res, 200, true, "Quiz submitted successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getQuizResult = async (
  req: Request<{ attemptId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await attemptService.getQuizResult(
      req.params.attemptId,
      getUserId(req),
    );

    return sendResponse(res, 200, true, "Result retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};
