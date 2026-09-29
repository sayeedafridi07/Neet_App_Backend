import { z } from "zod";

export const createClassSchema = z.object({
  name: z.string().trim().min(1, "Class name is required"),

  subjectId: z.uuid("Invalid subject ID"),
});

export const updateClassSchema = z
  .object({
    name: z.string().trim().min(1, "Class name is required").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const getClassSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export type CreateClassData = z.infer<typeof createClassSchema>;
export type UpdateClassData = z.infer<typeof updateClassSchema>;
