import prisma from "../../config/prisma.js";

import { AppError } from "../../utils/app-error.js";

import { QuizType } from "../../generated/prisma/enums.js";

import type {
  CreateQuestionData,
  CreateQuizData,
  UpdateQuestionData,
  UpdateQuizData,
} from "./quiz.schema.js";

type QuizPatch = UpdateQuizData;

const formatQuiz = (quiz: any) => {
  const { _count, ...rest } = quiz;

  return {
    ...rest,
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
const formatQuestion = (question: any) => {
  if (!question?.options) {
    return question;
  }

  return {
    ...question,
    options: question.options.map(formatOption),
  };
};

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
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  await prisma.quiz.delete({
    where: {
      id,
    },
  });
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

  return question;
};

export const updateQuestion = async (
  quizId: string,
  questionId: string,
  data: UpdateQuestionData,
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

  const { options, ...fields } = data;

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
      data: fields,
      include: {
        options: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });
  });

  return updated;
};

export const deleteQuestion = async (quizId: string, questionId: string) => {
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      quizId,
    },
    select: {
      id: true,
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
};
