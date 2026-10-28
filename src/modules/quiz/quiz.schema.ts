import { z } from "zod";
import { QuizType, QuestionType } from "../../generated/prisma/enums.js";

// Clients that build payloads dynamically tend to send null or "" for values
// they mean to leave untouched. z.coerce.number() turns null into 0, which
// would silently overwrite the marking scheme, so normalise them away first.
const optionalMarks = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.coerce
    .number()
    .finite("Marks must be a finite number")
    .optional(),
);

// Unlike the marking scheme, an explicit null here is meaningful: it detaches
// the quiz from its chapter. It is kept in the payload so the service can
// reject it for CHAPTER quizzes instead of silently ignoring the field.
const nullableUuid = z.uuid("Invalid chapter ID").nullable().optional();

/* -------------------------------------------------------------------------- */
/* QUESTION CONTENT                                                           */
/* -------------------------------------------------------------------------- */

// Match the Following
const matchTableBlockSchema = z.object({
  type: z.literal("MATCH_TABLE"),

  columns: z
    .array(
      z.object({
        key: z.string().trim().min(1, "Column key is required"),

        title: z.string().trim().min(1, "Column title is required"),

        items: z
          .array(
            z.object({
              key: z.string().trim().min(1, "Item key is required"),

              text: z.string().trim().min(1, "Item text is required"),
            }),
          )
          .min(1, "A column must have at least one item"),
      }),
    )
    .min(2, "A match table must have at least two columns"),
});

// Assertion / Reason
const assertionReasonBlockSchema = z.object({
  type: z.literal("ASSERTION_REASON"),

  assertion: z.string().trim().min(1, "Assertion is required"),

  reason: z.string().trim().min(1, "Reason is required"),
});

// All supported content block types
const questionContentBlockSchema = z.discriminatedUnion("type", [
  matchTableBlockSchema,
  assertionReasonBlockSchema,
]);

// Question content
const questionContentSchema = z
  .object({
    blocks: z
      .array(questionContentBlockSchema)
      .min(1, "At least one content block is required"),
  })
  .nullable();

/* -------------------------------------------------------------------------- */
/* QUIZ                                                                       */
/* -------------------------------------------------------------------------- */

export const createQuizSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),

    description: z.string().trim().optional(),

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

    description: z.string().trim().optional(),

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

/* -------------------------------------------------------------------------- */
/* QUESTION                                                                   */
/* -------------------------------------------------------------------------- */

export const createQuestionSchema = z.object({
  type: z.enum(QuestionType).default(QuestionType.SINGLE_CHOICE),

  question: z.string().trim().min(1, "Question is required"),

  explanation: z.string().trim().nullable().optional(),

  content: questionContentSchema.optional(),

  isActive: z.boolean().default(true),

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
      (options) =>
        options.filter((option) => option.isCorrect).length === 1,
      {
        message: "A question must have exactly one correct option",
      },
    ),
});

export const updateQuestionSchema = z
  .object({
    type: z.enum(QuestionType).optional(),

    question: z.string().trim().min(1, "Question is required").optional(),

    explanation: z.string().trim().nullable().optional(),

    content: questionContentSchema.optional(),

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
        (options) =>
          options.filter((option) => option.isCorrect).length === 1,
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

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export type CreateQuizData = z.infer<typeof createQuizSchema>;

export type UpdateQuizData = z.infer<typeof updateQuizSchema>;

export type CreateQuestionData = z.infer<typeof createQuestionSchema>;

export type UpdateQuestionData = z.infer<typeof updateQuestionSchema>;