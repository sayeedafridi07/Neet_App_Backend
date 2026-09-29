import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Subject name must be at least 2 characters"),
});

export const updateSubjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Subject name must be at least 2 characters")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const getSubjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export type CreateSubjectData = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectData = z.infer<typeof updateSubjectSchema>;
