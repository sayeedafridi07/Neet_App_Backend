import type { Request, Response, NextFunction } from "express";
import * as quizService from "./quiz.service.js";
import { sendResponse } from "../../utils/response.js";
import { getQuizzesSchema, getQuestionsSchema } from "./quiz.schema.js";

export const getQuizzes = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, chapterId, isActive } = getQuizzesSchema.parse(
      req.query,
    );

    const result = await quizService.getQuizzes(
      page,
      limit,
      search,
      chapterId,
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
    const quiz = await quizService.getQuizById(req.params.id);

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
    const { page, limit, search, isActive } = getQuestionsSchema.parse(
      req.query,
    );

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
    const result = await quizService.getOptions(
      req.params.quizId,
      req.params.questionId,
    );

    return sendResponse(
      res,
      200,
      true,
      "Options retrieved successfully",
      result,
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
    await quizService.deleteOption(
      req.params.quizId,
      req.params.questionId,
      req.params.optionId,
    );

    return sendResponse(res, 200, true, "Option deleted successfully");
  } catch (error) {
    next(error);
  }
};
