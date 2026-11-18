import { Router } from "express";

import {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} from "./subject.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createSubjectSchema, updateSubjectSchema } from "./subject.schema.js";

const router = Router();

// Authenticate all requests
router.use(authMiddleware);

// Student + Admin + Super Admin
router.get("/", getSubjects);

router.get("/:id", getSubjectById);

// Admin + Super Admin
router.post(
  "/",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  validate(createSubjectSchema),
  createSubject,
);

router.patch(
  "/:id",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  validate(updateSubjectSchema),
  updateSubject,
);

// Super Admin only
router.delete("/:id", allowRoles("SUPER_ADMIN"), deleteSubject);

export default router;
