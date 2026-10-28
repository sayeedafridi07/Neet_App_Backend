import prisma from "../../config/prisma.js";

import { AppError } from "../../utils/app-error.js";

import { QuizType } from "../../generated/prisma/enums.js";

import type {
  CreateQuestionData,
  CreateQuizData,
  UpdateQuestionData,
  UpdateQuizData,
} from "./quiz.schema.js";

import { parseQuestionsFromDocx } from "./quiz.import.js";

import {
  getImageKey,
  getUploadUrl,
  removeUploadedFile,
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

const formatOption = (option: any) => option;

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

// format
function formatQuestion(question: any) {
  const { imageKey, ...rest } = question;

  return {
    ...rest,
    imageUrl: imageKey ? getUploadUrl(imageKey) : null,
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
        where: {
          imageKey: {
            not: null,
          },
        },
        select: {
          imageKey: true,
        },
      },
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  await prisma.quiz.delete({
    where: {
      id,
    },
  });

  // Questions cascade with the quiz, so their images go with it
  await Promise.all(
    quiz.questions.map((question) => removeUploadedFile(question.imageKey!)),
  );
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

export const createQuestion = async (
  quizId: string,
  data: CreateQuestionData,
  image?: Express.Multer.File,
) => {
  const imageKey = image ? getImageKey(image) : undefined;

  try {
    return await insertQuestion(quizId, data, imageKey);
  } catch (error) {
    if (imageKey) {
      await removeUploadedFile(imageKey);
    }

    throw error;
  }
};

const insertQuestion = async (
  quizId: string,
  data: CreateQuestionData,
  imageKey?: string,
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

  const order = await getNextQuestionOrder(quizId);

  const question = await prisma.question.create({
    data: {
      question: data.question,
      explanation: data.explanation,
      imageKey,
      isActive: data.isActive,
      order,
      quizId,

      options: {
        create: data.options.map((option, index) => ({
          text: option.text,
          isCorrect: option.isCorrect,
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
  image?: Express.Multer.File,
) => {
  if (!image && Object.keys(data).length === 0) {
    throw new AppError(400, "At least one field is required");
  }

  const newImageKey = image ? getImageKey(image) : undefined;

  let previous;
  let updated;

  try {
    ({ previous, updated } = await applyQuestionUpdate(
      quizId,
      questionId,
      data,
      newImageKey,
    ));
  } catch (error) {
    if (newImageKey) {
      await removeUploadedFile(newImageKey);
    }

    throw error;
  }

  // Delete the old image only after the DB update succeeds
  if (previous.imageKey && previous.imageKey !== updated.imageKey) {
    await removeUploadedFile(previous.imageKey);
  }

  return formatQuestion(updated);
};

const applyQuestionUpdate = async (
  quizId: string,
  questionId: string,
  data: UpdateQuestionData,
  newImageKey?: string,
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

  const { options, removeImage, ...fields } = data;

  const imageKey = newImageKey ?? (removeImage ? null : undefined);

  const optionsChanged =
    options !== undefined &&
    JSON.stringify(
      options.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    ) !==
      JSON.stringify(
        question.options.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect,
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
        data: options.map((option, index) => ({
          text: option.text,
          isCorrect: option.isCorrect,
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

// All or nothing: a partially imported file is hard to fix and re-upload
// without creating duplicates, so any unparseable question rejects the file.
export const importQuestions = async (quizId: string, buffer: Buffer) => {
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
    parsed = await parseQuestionsFromDocx(buffer);
  } catch {
    throw new AppError(400, "Could not read the document. Upload a valid .docx file");
  }

  if (!parsed.length) {
    throw new AppError(400, 'No questions found. Each question must end with an "Ans: (x)" line');
  }

  const failed = parsed.filter((entry) => entry.error);

  if (failed.length) {
    throw new AppError(
      422,
      `Could not import ${failed.length} question(s): ` +
        failed
          .map((entry) => `#${entry.index} "${entry.preview}" - ${entry.error}`)
          .join("; "),
    );
  }

  const questions = await prisma.$transaction(
    async (tx) => {
      const lastQuestion = await tx.question.findFirst({
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

      let order = lastQuestion?.order ?? 0;
      const created = [];

      for (const { data } of parsed) {
        order += 1;

        created.push(
          await tx.question.create({
            data: {
              question: data!.question,
              explanation: data!.explanation,
              isActive: data!.isActive,
              order,
              quizId,

              options: {
                create: data!.options.map((option, index) => ({
                  text: option.text,
                  isCorrect: option.isCorrect,
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
          }),
        );
      }

      return created;
    },
    {
      timeout: 60_000,
    },
  );

  return {
    imported: questions.length,
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
    },
  });

  if (!question) {
    throw new AppError(404, "Question not found");
  }

  await prisma.question.delete({
    where: {
      id: questionId,
    },
  });

  if (question.imageKey) {
    await removeUploadedFile(question.imageKey);
  }
};
