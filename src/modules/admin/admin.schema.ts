import { z } from "zod";
import { AdminRole } from "../../generated/prisma/enums.js";

const adminRoleSchema = z.enum(AdminRole);

export const createAdminSchema = z.object({
  email: z.email("Invalid email address"),

  password: z.string().min(6, "Password must be at least 6 characters"),

  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .optional(),

  role: adminRoleSchema.optional(),
});

export const updateAdminSchema = z
  .object({
    email: z.email().optional(),

    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .optional(),

    role: adminRoleSchema.optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const getAdminsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export type CreateAdminData = z.infer<typeof createAdminSchema>;
export type UpdateAdminData = z.infer<typeof updateAdminSchema>;
