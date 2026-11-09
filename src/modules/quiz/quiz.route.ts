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

router.use(
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
);

router.get("/", getQuizzes);
router.get("/:id", getQuizById);
router.post("/", validate(createQuizSchema), createQuiz);
router.patch("/:id", validate(updateQuizSchema), updateQuiz);
router.delete(
  "/:id",
  allowRoles("SUPER_ADMIN"),
  deleteQuiz,
);

router.get("/:quizId/questions", getQuestions);
router.post(
  "/:quizId/questions",
  handleQuestionImageUpload,
  validate(createQuestionSchema),
  createQuestion,
);
router.post(
  "/:quizId/questions/import",
  handleDocumentUpload,
  importQuestions,
);

router.get("/:quizId/questions/:questionId", getQuestionById);
router.patch(
  "/:quizId/questions/:questionId",
  handleQuestionImageUpload,
  validate(updateQuestionSchema),
  updateQuestion,
);
router.delete(
  "/:quizId/questions/:questionId",
  allowRoles("SUPER_ADMIN"),
  deleteQuestion,
);

export default router;
