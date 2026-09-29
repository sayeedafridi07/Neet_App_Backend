import { Router } from "express";

import {
  getAudioLectures,
  getAudioLectureById,
  getAudioLectureBySlug,
  createAudioLecture,
  updateAudioLecture,
  deleteAudioLecture,
} from "./audio-lecture.controller.js";

import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { handleAudioUpload } from "../../config/multer.js";
import {
  createAudioLectureSchema,
  updateAudioLectureSchema,
} from "./audio-lecture.schema.js";

const router = Router();

router.use(
  adminAuthMiddleware,
  allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
);

router.get("/", getAudioLectures);
router.get("/:id", getAudioLectureById);
router.get("/chapter/:chapterId/slug/:slug", getAudioLectureBySlug);
router.post(
  "/",
  handleAudioUpload,
  validate(createAudioLectureSchema),
  createAudioLecture,
);
router.patch(
  "/:id",
  handleAudioUpload,
  validate(updateAudioLectureSchema),
  updateAudioLecture,
);
router.delete("/:id", allowRoles(AdminRole.SUPER_ADMIN), deleteAudioLecture);

export default router;
