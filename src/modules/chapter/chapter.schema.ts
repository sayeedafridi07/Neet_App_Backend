import { z } from "zod";

export const createChapterSchema = z.object({
  name: z.string().trim().min(1, "Chapter name is required"),

  order: z.coerce
    .number()
    .int()
    .min(1, "Order must be a positive integer"),

  classId: z.uuid("Invalid class ID"),
});

export const updateChapterSchema = z
  .object({
    name: z.string().trim().min(1, "Chapter name is required").optional(),

    order: z.coerce
      .number()
      .int()
      .min(1, "Order must be a positive integer")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const getChapterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  classId: z.uuid("Invalid class ID").optional(),
});

export type CreateChapterData = z.infer<typeof createChapterSchema>;
export type UpdateChapterData = z.infer<typeof updateChapterSchema>;
