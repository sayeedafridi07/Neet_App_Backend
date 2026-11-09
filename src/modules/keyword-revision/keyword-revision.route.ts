import { Router } from "express";

import {
  getKeywordRevisions,
  getKeywordRevisionById,
  getKeywordRevisionBySlug,
  createKeywordRevision,
  updateKeywordRevision,
  toggleStatus,
  deleteKeywordRevision,
} from "./keyword-revision.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { handleAudioUpload } from "../../config/multer.js";

import {
  createKeywordRevisionSchema,
  updateKeywordRevisionSchema,
} from "./keyword-revision.schema.js";

const router = Router();

// Authenticate all requests
router.use(authMiddleware);

// Student + Admin + Super Admin
router.get("/", getKeywordRevisions);

router.get("/:id", getKeywordRevisionById);

router.get("/chapter/:chapterId/slug/:slug", getKeywordRevisionBySlug);

// Admin + Super Admin
router.post(
  "/",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleAudioUpload,
  validate(createKeywordRevisionSchema),
  createKeywordRevision,
);

router.patch(
  "/:id",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleAudioUpload,
  validate(updateKeywordRevisionSchema),
  updateKeywordRevision,
);

router.patch("/:id/status", allowRoles("ADMIN", "SUPER_ADMIN"), toggleStatus);

// Super Admin only
router.delete("/:id", allowRoles("SUPER_ADMIN"), deleteKeywordRevision);

export default router;
