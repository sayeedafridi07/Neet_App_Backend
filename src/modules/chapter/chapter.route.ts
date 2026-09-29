import { Router } from "express";

import {
  getChapters,
  getChapterById,
  getChapterBySlug,
  createChapter,
  updateChapter,
  deleteChapter,
} from "./chapter.controller.js";

import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createChapterSchema, updateChapterSchema } from "./chapter.schema.js";

const router = Router();

router.use(
  adminAuthMiddleware,
  allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
);

router.get("/", getChapters);
router.get("/:id", getChapterById);
router.get("/class/:classId/slug/:slug", getChapterBySlug);
router.post("/", validate(createChapterSchema), createChapter);
router.patch("/:id", validate(updateChapterSchema), updateChapter);
router.delete("/:id", allowRoles(AdminRole.SUPER_ADMIN), deleteChapter);

export default router;
