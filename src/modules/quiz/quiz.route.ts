import { Router } from "express";

import {
  createQuestion,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  getQuestionById,
  getQuestions,
  getQuizById,
  getQuizzes,
  importQuestions,
  updateQuestion,
  updateQuiz
} from "./quiz.controller.js";

import { handleDocumentUpload, handleQuestionImageUpload } from "../../config/multer.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createQuestionSchema,
  createQuizSchema,
  updateQuestionSchema,
  updateQuizSchema,
} from "./quiz.schema.js";

const router = Router();

// Authenticate all requests
router.use(authMiddleware);

// Student + Admin + Super Admin
router.get("/", getQuizzes);
router.get("/:id", getQuizById);
router.get("/:quizId/questions", getQuestions);
router.get("/:quizId/questions/:questionId", getQuestionById);

// Admin + Super Admin
router.post(
  "/",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  validate(createQuizSchema),
  createQuiz,
);

router.patch(
  "/:id",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  validate(updateQuizSchema),
  updateQuiz,
);

router.post(
  "/:quizId/questions",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleQuestionImageUpload,
  validate(createQuestionSchema),
  createQuestion,
);

router.post(
  "/:quizId/questions/import",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleDocumentUpload,
  importQuestions,
);

router.patch(
  "/:quizId/questions/:questionId",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleQuestionImageUpload,
  validate(updateQuestionSchema),
  updateQuestion,
);

// Super Admin only
router.delete("/:id", allowRoles("SUPER_ADMIN"), deleteQuiz);

router.delete(
  "/:quizId/questions/:questionId",
  allowRoles("SUPER_ADMIN"),
  deleteQuestion,
);

export default router;
