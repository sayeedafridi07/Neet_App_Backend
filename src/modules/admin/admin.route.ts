import { Router } from "express";

import {
  createAdmin,
  getAdminById,
  getAdmins,
  toggleStatus,
  updateAdmin,
  deleteAdmin,
} from "./admin.controller.js";

import { AdminRole } from "../../generated/prisma/enums.js";
import { adminAuthMiddleware } from "../../middlewares/admin-auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createAdminSchema, updateAdminSchema } from "./admin.schema.js";

const router = Router();

router.use(
  adminAuthMiddleware,
  allowRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
);

router.get("/", getAdmins);
router.get("/:id", getAdminById);
router.post("/", validate(createAdminSchema), createAdmin);
router.patch("/:id", validate(updateAdminSchema), updateAdmin);
router.patch("/:id/status", toggleStatus);
router.delete("/:id", allowRoles(AdminRole.SUPER_ADMIN), deleteAdmin);

export default router;
