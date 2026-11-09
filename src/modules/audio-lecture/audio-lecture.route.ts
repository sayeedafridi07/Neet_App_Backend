import { Router } from "express";

import {
  getAudioLectures,
  getAudioLectureById,
  getAudioLectureBySlug,
  createAudioLecture,
  updateAudioLecture,
  toggleStatus,
  deleteAudioLecture,
} from "./audio-lecture.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { handleAudioUpload } from "../../config/multer.js";

import {
  createAudioLectureSchema,
  updateAudioLectureSchema,
} from "./audio-lecture.schema.js";

const router = Router();

// Authenticate all requests
router.use(authMiddleware);

// Student + Admin + Super Admin
router.get("/", getAudioLectures);

router.get("/:id", getAudioLectureById);

router.get("/chapter/:chapterId/slug/:slug", getAudioLectureBySlug);

// Admin + Super Admin
router.post(
  "/",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleAudioUpload,
  validate(createAudioLectureSchema),
  createAudioLecture,
);

router.patch(
  "/:id",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleAudioUpload,
  validate(updateAudioLectureSchema),
  updateAudioLecture,
);

router.patch("/:id/status", allowRoles("ADMIN", "SUPER_ADMIN"), toggleStatus);

// Super Admin only
router.delete("/:id", allowRoles("SUPER_ADMIN"), deleteAudioLecture);

export default router;
