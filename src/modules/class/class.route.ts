import { Router } from "express";

import {
  getClasses,
  getClassById,
  getClassBySlug,
  createClass,
  updateClass,
  deleteClass,
} from "./class.controller.js";

import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createClassSchema, updateClassSchema } from "./class.schema.js";

const router = Router();

router.use(
  adminAuthMiddleware,
  allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
);

router.get("/", getClasses);
router.get("/:id", getClassById);
router.get("/subject/:subjectId/slug/:slug", getClassBySlug);
router.post("/", validate(createClassSchema), createClass);
router.patch("/:id", validate(updateClassSchema), updateClass);
router.delete("/:id", allowRoles(AdminRole.SUPER_ADMIN), deleteClass);

export default router;
