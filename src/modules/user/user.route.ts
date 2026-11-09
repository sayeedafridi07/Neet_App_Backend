import { Router } from "express";

import {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  resetDevice,
  toggleStatus,
  updateUser,
} from "./user.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/allow-role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createUserSchema,
  updateUserSchema
} from "./user.schema.js";

const router = Router();

router.use(
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
);

router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/", validate(createUserSchema), createUser);
router.patch("/:id", validate(updateUserSchema), updateUser);
router.patch("/:id/status", toggleStatus);
router.patch("/:id/reset-device", resetDevice);
router.delete("/:id", allowRoles("SUPER_ADMIN"), deleteUser);

export default router;
