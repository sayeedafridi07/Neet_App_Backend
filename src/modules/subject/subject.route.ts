import { Router } from "express";

import {
  getSubjects,
  getSubjectById,
  getSubjectBySlug,
  createSubject,
  updateSubject,
  deleteSubject,
} from "./subject.controller.js";

import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createSubjectSchema, updateSubjectSchema } from "./subject.schema.js";

const router = Router();

router.use(
  adminAuthMiddleware,
  allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
);

router.get("/", getSubjects);
router.get("/:id", getSubjectById);
router.get("/slug/:slug", getSubjectBySlug);
router.post("/", validate(createSubjectSchema), createSubject);
router.patch("/:id", validate(updateSubjectSchema), updateSubject);
router.delete("/:id", allowRoles(AdminRole.SUPER_ADMIN), deleteSubject);

export default router;
