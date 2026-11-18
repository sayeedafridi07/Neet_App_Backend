import { Router } from "express";

import {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
} from "./class.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createClassSchema, updateClassSchema } from "./class.schema.js";

const router = Router();

// Authenticate all requests
router.use(authMiddleware);

// Student + Admin + Super Admin
router.get("/", getClasses);
router.get("/:id", getClassById);

// Admin + Super Admin
router.post(
  "/",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  validate(createClassSchema),
  createClass,
);

router.patch(
  "/:id",
  allowRoles("ADMIN", "SUPER_ADMIN"),
  validate(updateClassSchema),
  updateClass,
);

// Super Admin only
router.delete("/:id", allowRoles("SUPER_ADMIN"), deleteClass);

export default router;
