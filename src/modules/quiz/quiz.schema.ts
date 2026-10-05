import { z } from "zod";

import { QuizType } from "../../generated/prisma/enums.js";

// Clients that build payloads dynamically tend to send null or "" for values
// they mean to leave untouched. z.coerce.number() turns null into 0, which
// would silently overwrite the marking scheme, so normalise them away first.
const optionalMarks = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.coerce.number().finite("Marks must be a finite number").optional(),
);

// Unlike the marking scheme, an explicit null here is meaningful: it detaches
// the quiz from its chapter. It is kept in the payload so the service can
// reject it for CHAPTER quizzes instead of silently ignoring the field.
const nullableUuid = z.uuid("Invalid chapter ID").nullable().optional();

export const createQuizSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),

    description: z.string().trim().min(1).optional(),

    type: z.enum(QuizType),

    chapterId: nullableUuid,

    durationMinutes: z.coerce
      .number()
      .int()
      .min(1, "Duration must be a positive number of minutes")
      .optional(),

    correctMarks: optionalMarks,
    wrongMarks: optionalMarks,
    skippedMarks: optionalMarks,

    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === QuizType.CHAPTER && !data.chapterId) {
      ctx.addIssue({
        code: "custom",
        path: ["chapterId"],
        message: "Chapter is required for chapter quizzes",
      });
    }
  });

export const updateQuizSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").optional(),

    description: z.string().trim().min(1).optional(),

    type: z.enum(QuizType).optional(),

    chapterId: nullableUuid,

    durationMinutes: z.coerce
      .number()
      .int()
      .min(1, "Duration must be a positive number of minutes")
      .optional(),

    correctMarks: optionalMarks,
    wrongMarks: optionalMarks,
    skippedMarks: optionalMarks,

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const getQuizzesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  chapterId: z.uuid("Invalid chapter ID").optional(),
  type: z.enum(QuizType).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});


export const createQuestionSchema = z.object({
  question: z.string().min(1, "Question is required"),

  explanation: z.string().optional(),

  isActive: z.boolean().default(true),

  options: z
    .array(
      z.object({
        text: z.string().min(1, "Option text is required"),
        isCorrect: z.boolean(),
      }),
    )
    .min(2, "A question must have at least two options")
    .max(6, "A question cannot have more than six options")
    .refine(
      (options) => options.filter((option) => option.isCorrect).length === 1,
      {
        message: "A question must have exactly one correct option",
      },
    ),
});

export const updateQuestionSchema = z
  .object({
    question: z.string().trim().min(1, "Question is required").optional(),

    explanation: z.string().trim().min(1, "Explanation is required").optional(),

    isActive: z.boolean().optional(),

    options: z
      .array(
        z.object({
          text: z.string().trim().min(1, "Option text is required"),
          isCorrect: z.boolean(),
        }),
      )
      .min(2, "A question must have at least two options")
      .max(6, "A question cannot have more than six options")
      .refine(
        (options) => options.filter((option) => option.isCorrect).length === 1,
        {
          message: "A question must have exactly one correct option",
        },
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
export const getQuestionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type CreateQuizData = z.infer<typeof createQuizSchema>;
export type UpdateQuizData = z.infer<typeof updateQuizSchema>;
export type CreateQuestionData = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionData = z.infer<typeof updateQuestionSchema>;
