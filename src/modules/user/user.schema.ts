import { z } from "zod";

export const createUserSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid mobile number"),

  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .optional(),

  targetYear: z.number().int().positive().optional(),

  city: z.string().trim().optional(),

  schoolName: z.string().trim().optional(),

  profileComplete: z.boolean().optional(),
});

export const updateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .optional(),

    targetYear: z.number().int().positive().optional(),

    city: z.string().trim().optional(),

    schoolName: z.string().trim().optional(),

    profileComplete: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const getUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export type CreateUserData = z.infer<typeof createUserSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
