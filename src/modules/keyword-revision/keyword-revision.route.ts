import { Router } from "express";

import {
  getKeywordRevisions,
  getStudentKeywordRevisions,
  getKeywordRevisionById,
  createKeywordRevision,
  updateKeywordRevision,
  toggleStatus,
  deleteKeywordRevision,
  importKeywordRevisions,
} from "./keyword-revision.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { handleAudioUpload, handleDocumentUpload } from "../../config/multer.js";

import {
  createKeywordRevisionSchema,
  updateKeywordRevisionSchema,
} from "./keyword-revision.schema.js";

const router = Router();

// Authenticate all requests
router.use(authMiddleware);

// Student + Admin + Super Admin
router.get("/", getKeywordRevisions);

// Chapters with their active keyword revisions (must be before /:id)
router.get("/student", getStudentKeywordRevisions);

router.get("/:id", getKeywordRevisionById);

// Admin + Super Admin
router.post(
  "/",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleAudioUpload,
  validate(createKeywordRevisionSchema),
  createKeywordRevision,
);

// Bulk create from an .xlsx sheet; audio is a placeholder until uploaded
router.post(
  "/import",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  handleDocumentUpload,
  importKeywordRevisions,
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
