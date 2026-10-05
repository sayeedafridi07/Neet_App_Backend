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
  updateQuestion,
  updateQuiz
} from "./quiz.controller.js";

import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
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
  adminAuthMiddleware,
  allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
);

router.get("/", getQuizzes);
router.get("/:id", getQuizById);
router.post("/", validate(createQuizSchema), createQuiz);
router.patch("/:id", validate(updateQuizSchema), updateQuiz);
router.delete(
  "/:id",
  allowRoles(AdminRole.SUPER_ADMIN),
  deleteQuiz,
);

router.get("/:quizId/questions", getQuestions);
router.post(
  "/:quizId/questions",
  validate(createQuestionSchema),
  createQuestion,
);

router.get("/:quizId/questions/:questionId", getQuestionById);
router.patch(
  "/:quizId/questions/:questionId",
  validate(updateQuestionSchema),
  updateQuestion,
);
router.delete(
  "/:quizId/questions/:questionId",
  allowRoles(AdminRole.SUPER_ADMIN),
  deleteQuestion,
);

export default router;
