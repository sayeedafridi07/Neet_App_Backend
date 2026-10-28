import { z } from "zod";
import { formBoolean } from "../../utils/form.js";

export const createKeywordRevisionSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),

  description: z.string().trim().optional(),

  duration: z.coerce
    .number()
    .int()
    .min(1, "Duration must be a positive number of seconds"),

  order: z.coerce.number().int().min(1, "Sort order must be a positive integer"),

  isActive: z.boolean().optional(),

  chapterId: z.uuid("Invalid chapter ID"),
});

// Emptiness is checked in the service, since an upload alone is a valid update
export const updateKeywordRevisionSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").optional(),

    description: z.string().trim().optional(),

    duration: z.coerce
      .number()
      .int()
      .min(1, "Duration must be a positive number of seconds")
      .optional(),

    order: z.coerce
      .number()
      .int()
      .min(1, "Sort order must be a positive integer")
      .optional(),

    isActive: z.boolean().optional(),

    // Clears the current image when no new one is uploaded
    removeImage: formBoolean.optional(),
  });

export const getKeywordRevisionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  chapterId: z.uuid("Invalid chapter ID").optional(),
  isActive: z.boolean().optional(),
});

export type CreateKeywordRevisionData = z.infer<typeof createKeywordRevisionSchema>;
export type UpdateKeywordRevisionData = z.infer<typeof updateKeywordRevisionSchema>;
