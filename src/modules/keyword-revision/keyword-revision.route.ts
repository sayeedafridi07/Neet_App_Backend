import { Router } from "express";

import {
  getKeywordRevisions,
  getKeywordRevisionById,
  getKeywordRevisionBySlug,
  createKeywordRevision,
  updateKeywordRevision,
  deleteKeywordRevision,
} from "./keyword-revision.controller.js";

import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { handleAudioUpload } from "../../config/multer.js";
import {
  createKeywordRevisionSchema,
  updateKeywordRevisionSchema,
} from "./keyword-revision.schema.js";

const router = Router();

router.use(
  adminAuthMiddleware,
  allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
);

router.get("/", getKeywordRevisions);
router.get("/:id", getKeywordRevisionById);
router.get("/chapter/:chapterId/slug/:slug", getKeywordRevisionBySlug);
router.post(
  "/",
  handleAudioUpload,
  validate(createKeywordRevisionSchema),
  createKeywordRevision,
);
router.patch(
  "/:id",
  handleAudioUpload,
  validate(updateKeywordRevisionSchema),
  updateKeywordRevision,
);
router.delete(
  "/:id",
  allowRoles(AdminRole.SUPER_ADMIN),
  deleteKeywordRevision,
);

export default router;
