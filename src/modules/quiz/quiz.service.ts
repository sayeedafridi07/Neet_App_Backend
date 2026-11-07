import { randomUUID } from "node:crypto";

import prisma from "../../config/prisma.js";

import { AppError } from "../../utils/app-error.js";

import { QuizType } from "../../generated/prisma/enums.js";

import type {
  CreateQuestionData,
  CreateQuizData,
  UpdateQuestionData,
  UpdateQuizData,
} from "./quiz.schema.js";

import type { DocumentKind } from "../../config/multer.js";
import { parseQuestionsFromDocx, parseQuestionsFromXlsx } from "./quiz.import.js";

import {
  getImageKey,
  getUploadUrl,
  removeUploadedFile,
  saveImageBuffer,
} from "../../config/multer.js";

type QuizPatch = UpdateQuizData;

const formatQuiz = (quiz: any) => {
  const { _count, ...rest } = quiz;

  return {
    ...rest,
    ...(rest.questions ? { questions: rest.questions.map(formatQuestion) } : {}),
    questionCount: _count?.questions ?? 0,
  };
};

const formatOption = (option: any) => {
  const { imageKey, ...rest } = option;

  return {
    ...rest,
    imageUrl: imageKey ? getUploadUrl(imageKey) : null,
  };
};

// Shared so create, update and read all return the same quiz shape.
const quizInclude = {
  chapter: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  _count: {
    select: {
      questions: true,
    },
  },
};

// Every stored image of a question: its own, the explanation's and the options'.
const questionImageKeys = (question: {
  imageKey: string | null;
  explanationImageKey: string | null;
  options: { imageKey: string | null }[];
}) =>
  [
    question.imageKey,
    question.explanationImageKey,
    ...question.options.map((option) => option.imageKey),
  ].filter((key): key is string => Boolean(key));

// format
function formatQuestion(question: any) {
  const { imageKey, explanationImageKey, ...rest } = question;

  return {
    ...rest,
    imageUrl: imageKey ? getUploadUrl(imageKey) : null,
    explanationImageUrl: explanationImageKey ? getUploadUrl(explanationImageKey) : null,
    ...(rest.options ? { options: rest.options.map(formatOption) } : {}),
  };
}

const assertChapterExists = async (chapterId: string) => {
  const chapter = await prisma.chapter.findUnique({
    where: {
      id: chapterId,
    },
    select: {
      id: true,
    },
  });

  if (!chapter) {
    throw new AppError(404, "Chapter not found");
  }
};

// `order` is unique per quiz / per question but is never client supplied:
// assigning max + 1 keeps appends collision free without a reordering API.
const getNextQuestionOrder = async (quizId: string) => {
  const lastQuestion = await prisma.question.findFirst({
    where: {
      quizId,
    },
    orderBy: {
      order: "desc",
    },
    select: {
      order: true,
    },
  });

  return (lastQuestion?.order ?? 0) + 1;
};

// main apis
export const getQuizzes = async (
  page: number,
  limit: number,
  search?: string,
  chapterId?: string,
  isActive?: boolean,
) => {
  const skip = (page - 1) * limit;

  const where = {
    ...(chapterId ? { chapterId } : {}),
    ...(isActive === undefined ? {} : { isActive }),

    ...(search
      ? {
          OR: [
            {
              title: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      include: quizInclude,
    }),

    prisma.quiz.count({
      where,
    }),
  ]);

  return {
    quizzes: quizzes.map(formatQuiz),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getQuizById = async (id: string) => {
  const quiz = await prisma.quiz.findUnique({
    where: {
      id,
    },

    include: {
      ...quizInclude,

      questions: {
        orderBy: {
          order: "asc",
        },

        include: {
          options: {
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  return formatQuiz(quiz);
};

export const createQuiz = async (data: CreateQuizData) => {
  if (data.chapterId) {
    await assertChapterExists(data.chapterId);
  }

  const quiz = await prisma.quiz.create({
    data: {
      title: data.title,
      description: data.description,
      type: data.type,
      chapterId: data.chapterId,
      durationMinutes: data.durationMinutes,
      correctMarks: data.correctMarks,
      wrongMarks: data.wrongMarks,
      skippedMarks: data.skippedMarks,
    },
    include: quizInclude,
  });

  return formatQuiz(quiz);
};

export const updateQuiz = async (id: string, data: UpdateQuizData) => {
  const quiz = await prisma.quiz.findUnique({
    where: {
      id,
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  const patch: QuizPatch = {
    ...data,
  };

  if (data.chapterId) {
    await assertChapterExists(data.chapterId);
  }

  const nextType = data.type ?? quiz.type;
  const nextChapterId =
    data.chapterId === undefined ? quiz.chapterId : data.chapterId;

  if (nextType === QuizType.CHAPTER && !nextChapterId) {
    throw new AppError(400, "Chapter is required for chapter quizzes");
  }

  const updated = await prisma.quiz.update({
    where: {
      id,
    },
    data: patch,
    include: quizInclude,
  });

  return formatQuiz(updated);
};

export const deleteQuiz = async (id: string) => {
  const quiz = await prisma.quiz.findUnique({
    where: {
      id,
    },
    include: {
      questions: {
        select: {
          imageKey: true,
          explanationImageKey: true,
          options: {
            select: {
              imageKey: true,
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  await prisma.$transaction([
    prisma.questionOption.deleteMany({
      where: {
        question: {
          quizId: id,
        },
      },
    }),
    prisma.question.deleteMany({
      where: {
        quizId: id,
      },
    }),
    prisma.quiz.delete({
      where: {
        id,
      },
    }),
  ]);

  await Promise.all(quiz.questions.flatMap(questionImageKeys).map(removeUploadedFile));
};

export const getQuestions = async (
  quizId: string,
  page: number,
  limit: number,
  search?: string,
  isActive?: boolean,
) => {
  const quiz = await prisma.quiz.findUnique({
    where: {
      id: quizId,
    },
    select: {
      id: true,
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  const skip = (page - 1) * limit;

  const where = {
    quizId,
    ...(isActive === undefined ? {} : { isActive }),

    ...(search
      ? {
          question: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        order: "asc",
      },
      include: {
        options: {
          orderBy: {
            order: "asc",
          },
        },
      },
    }),

    prisma.question.count({
      where,
    }),
  ]);

  return {
    questions: questions.map(formatQuestion),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getQuestionById = async (quizId: string, questionId: string) => {
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      quizId,
    },
    include: {
      options: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!question) {
    throw new AppError(404, "Question not found");
  }

  return formatQuestion(question);
};

export type QuestionImages = {
  image?: Express.Multer.File;
  explanationImage?: Express.Multer.File;
  // Indexed like the options they belong to
  optionImages: (Express.Multer.File | undefined)[];
};

type QuestionImageKeys = {
  image?: string;
  explanationImage?: string;
  optionImages: (string | undefined)[];
};

const getQuestionImageKeys = (images: QuestionImages): QuestionImageKeys => ({
  image: images.image ? getImageKey(images.image) : undefined,
  explanationImage: images.explanationImage
    ? getImageKey(images.explanationImage)
    : undefined,
  optionImages: images.optionImages.map((file) =>
    file ? getImageKey(file) : undefined,
  ),
});

const allImageKeys = (keys: QuestionImageKeys) =>
  [keys.image, keys.explanationImage, ...keys.optionImages].filter(
    (key): key is string => Boolean(key),
  );

const assertOptionImagesFit = (
  optionImages: (string | undefined)[],
  optionCount: number,
) => {
  const index = optionImages.findIndex(
    (key, position) => key && position >= optionCount,
  );

  if (index !== -1) {
    throw new AppError(
      400,
      `Image uploaded for option ${index + 1}, but the question has only ${optionCount} options`,
    );
  }
};

const assertOptionsHaveContent = (
  options: { text: string; imageKey?: string | null }[],
) => {
  const index = options.findIndex((option) => !option.text && !option.imageKey);

  if (index !== -1) {
    throw new AppError(400, `Option ${index + 1} needs text or an image`);
  }
};

export const createQuestion = async (
  quizId: string,
  data: CreateQuestionData,
  images: QuestionImages,
) => {
  const imageKeys = getQuestionImageKeys(images);

  try {
    return await insertQuestion(quizId, data, imageKeys);
  } catch (error) {
    await Promise.all(allImageKeys(imageKeys).map(removeUploadedFile));

    throw error;
  }
};

const insertQuestion = async (
  quizId: string,
  data: CreateQuestionData,
  imageKeys: QuestionImageKeys,
) => {
  assertOptionImagesFit(imageKeys.optionImages, data.options.length);

  assertOptionsHaveContent(
    data.options.map((option, index) => ({
      text: option.text,
      imageKey: imageKeys.optionImages[index],
    })),
  );

  const quiz = await prisma.quiz.findUnique({
    where: {
      id: quizId,
    },
    select: {
      id: true,
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  const order = await getNextQuestionOrder(quizId);

  const question = await prisma.question.create({
    data: {
      question: data.question,
      explanation: data.explanation,
      imageKey: imageKeys.image,
      explanationImageKey: imageKeys.explanationImage,
      isActive: data.isActive,
      order,
      quizId,

      options: {
        create: data.options.map((option, index) => ({
          text: option.text,
          isCorrect: option.isCorrect,
          imageKey: imageKeys.optionImages[index],
          order: index + 1,
        })),
      },
    },

    include: {
      options: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  return formatQuestion(question);
};

export const updateQuestion = async (
  quizId: string,
  questionId: string,
  data: UpdateQuestionData,
  images: QuestionImages,
) => {
  const imageKeys = getQuestionImageKeys(images);
  const uploadedKeys = allImageKeys(imageKeys);

  if (uploadedKeys.length === 0 && Object.keys(data).length === 0) {
    throw new AppError(400, "At least one field is required");
  }

  let previous;
  let updated;

  try {
    ({ previous, updated } = await applyQuestionUpdate(
      quizId,
      questionId,
      data,
      imageKeys,
    ));
  } catch (error) {
    await Promise.all(uploadedKeys.map(removeUploadedFile));

    throw error;
  }

  // Delete replaced or removed images only after the DB update succeeds
  const kept = new Set(questionImageKeys(updated));

  await Promise.all(
    questionImageKeys(previous)
      .filter((key) => !kept.has(key))
      .map(removeUploadedFile),
  );

  return formatQuestion(updated);
};

const applyQuestionUpdate = async (
  quizId: string,
  questionId: string,
  data: UpdateQuestionData,
  imageKeys: QuestionImageKeys,
) => {
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      quizId,
    },
    include: {
      options: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!question) {
    throw new AppError(404, "Question not found");
  }

  const { options, removeImage, removeExplanationImage, ...fields } = data;

  const imageKey = imageKeys.image ?? (removeImage ? null : undefined);

  const explanationImageKey =
    imageKeys.explanationImage ?? (removeExplanationImage ? null : undefined);

  // Option images can be uploaded without resending the options, in which
  // case they apply to the current options by index.
  const nextOptions = (options ?? question.options).map((option, index) => ({
    text: option.text,
    isCorrect: option.isCorrect,
    imageKey:
      imageKeys.optionImages[index] ??
      (options?.[index]?.removeImage
        ? null
        : (question.options[index]?.imageKey ?? null)),
  }));

  assertOptionImagesFit(imageKeys.optionImages, nextOptions.length);
  assertOptionsHaveContent(nextOptions);

  const optionsChanged =
    JSON.stringify(nextOptions) !==
    JSON.stringify(
      question.options.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
        imageKey: option.imageKey,
      })),
    );

  const updated = await prisma.$transaction(async (tx) => {
    if (optionsChanged) {
      await tx.questionOption.deleteMany({
        where: {
          questionId,
        },
      });

      await tx.questionOption.createMany({
        data: nextOptions.map((option, index) => ({
          ...option,
          order: index + 1,
          questionId,
        })),
      });
    }

    return tx.question.update({
      where: {
        id: questionId,
      },
      data: {
        ...fields,
        imageKey,
        explanationImageKey,
      },
      include: {
        options: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });
  });

  return {
    previous: question,
    updated,
  };
};

// Valid questions are imported and the rest are skipped and listed in the
// result. The file is only rejected when none of its questions can be used.
export const importQuestions = async (
  quizId: string,
  buffer: Buffer,
  kind: DocumentKind = "docx",
) => {
  const quiz = await prisma.quiz.findUnique({
    where: {
      id: quizId,
    },
    select: {
      id: true,
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  let parsed;

  try {
    parsed =
      kind === "xlsx" ? await parseQuestionsFromXlsx(buffer) : await parseQuestionsFromDocx(buffer);
  } catch (error) {
    throw new AppError(
      400,
      kind === "xlsx"
        ? `Could not read the spreadsheet. ${error instanceof Error ? error.message : ""}`.trim()
        : "Could not read the document. Upload a valid .docx file",
    );
  }

  if (!parsed.length) {
    throw new AppError(
      400,
      kind === "xlsx"
        ? "No questions found in the first sheet"
        : 'No questions found. Each question must end with an "Ans: (x)" line',
    );
  }

  const total = parsed.length;

  // Questions with problems are skipped and reported back, so the rest of the
  // file still imports.
  const skipped = parsed
    .filter((entry) => entry.error)
    .map(({ index, preview, error }) => ({ index, preview, error: error! }));

  parsed = parsed.filter((entry) => !entry.error);

  if (!parsed.length) {
    throw new AppError(
      422,
      `None of the ${total} question(s) could be imported: ` +
        skipped.map((entry) => `#${entry.index} "${entry.preview}" - ${entry.error}`).join("; "),
    );
  }

  // Images are written only once the questions are validated, and removed
  // again if the questions cannot be saved.
  const savedKeys: string[] = [];
  const removeSaved = () => Promise.all(savedKeys.map((key) => removeUploadedFile(key)));

  const save = async (image?: { buffer: Buffer; contentType: string }) => {
    if (!image) {
      return undefined;
    }

    const key = await saveImageBuffer(image.buffer, image.contentType);
    savedKeys.push(key);

    return key;
  };

  const imageKeys: {
    question?: string;
    explanation?: string;
    options: (string | undefined)[];
  }[] = [];

  try {
    for (const entry of parsed) {
      const options: (string | undefined)[] = [];

      for (const image of entry.optionImages ?? []) {
        options.push(await save(image));
      }

      imageKeys.push({
        question: await save(entry.image),
        explanation: await save(entry.explanationImage),
        options,
      });
    }
  } catch (error) {
    await removeSaved();
    throw error;
  }

  const lastQuestion = await prisma.question.findFirst({
    where: {
      quizId,
    },
    orderBy: {
      order: "desc",
    },
    select: {
      order: true,
    },
  });

  const firstOrder = (lastQuestion?.order ?? 0) + 1;

  // Ids are generated up front so questions and options go in as two bulk
  // inserts. Creating them one by one in an interactive transaction makes a
  // round trip per row and outlives the transaction on large files.
  const rows = parsed.map(({ data }, index) => ({
    id: randomUUID(),
    question: data!.question,
    explanation: data!.explanation,
    isActive: data!.isActive,
    imageKey: imageKeys[index]!.question,
    explanationImageKey: imageKeys[index]!.explanation,
    order: firstOrder + index,
    quizId,
  }));

  const options = parsed.flatMap(({ data }, index) =>
    data!.options.map((option, optionIndex) => ({
      questionId: rows[index]!.id,
      text: option.text,
      isCorrect: option.isCorrect,
      imageKey: imageKeys[index]!.options[optionIndex],
      order: optionIndex + 1,
    })),
  );

  try {
    await prisma.$transaction([
      prisma.question.createMany({ data: rows }),
      prisma.questionOption.createMany({ data: options }),
    ]);
  } catch (error) {
    await removeSaved();
    throw error;
  }

  const questions = await prisma.question.findMany({
    where: {
      id: {
        in: rows.map((row) => row.id),
      },
    },
    orderBy: {
      order: "asc",
    },
    include: {
      options: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  return {
    imported: questions.length,
    total,
    skipped,
    questions: questions.map(formatQuestion),
  };
};

export const deleteQuestion = async (quizId: string, questionId: string) => {
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      quizId,
    },
    select: {
      id: true,
      imageKey: true,
      explanationImageKey: true,
      options: {
        select: {
          imageKey: true,
        },
      },
    },
  });

  if (!question) {
    throw new AppError(404, "Question not found");
  }

  await prisma.$transaction([
    prisma.questionOption.deleteMany({
      where: {
        questionId,
      },
    }),
    prisma.question.delete({
      where: {
        id: questionId,
      },
    }),
  ]);

  await Promise.all(questionImageKeys(question).map(removeUploadedFile));
};
