import prisma from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { generateSlug } from "../../utils/slug.js";
import type { CreateChapterData, UpdateChapterData } from "./chapter.schema.js";

export const getChapters = async (
  page: number,
  limit: number,
  search?: string,
  classId?: string,
) => {
  const skip = (page - 1) * limit;

  const where = {
    ...(classId ? { classId } : {}),

    ...(search
      ? {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const [chapters, total] = await Promise.all([
    prisma.chapter.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        order: "asc",
      },
    }),

    prisma.chapter.count({
      where,
    }),
  ]);

  return {
    chapters,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getChapterById = async (id: string) => {
  return prisma.chapter.findUnique({
    where: {
      id,
    },
  });
};

export const getChapterBySlug = async (classId: string, slug: string) => {
  return prisma.chapter.findFirst({
    where: {
      classId,
      slug,
    },
  });
};

export const createChapter = async (data: CreateChapterData) => {
  const academicClass = await prisma.academicClass.findUnique({
    where: {
      id: data.classId,
    },
  });

  if (!academicClass) {
    throw new AppError(404, "Class not found");
  }

  const slug = generateSlug(data.name);

  const existingChapter = await prisma.chapter.findFirst({
    where: {
      classId: data.classId,
      slug,
    },
  });

  if (existingChapter) {
    throw new AppError(409, "Chapter with this name already exists in this class");
  }

  return prisma.chapter.create({
    data: {
      name: data.name,
      slug,
      order: data.order,
      classId: data.classId,
    },
  });
};

export const updateChapter = async (id: string, data: UpdateChapterData) => {
  const chapter = await prisma.chapter.findUnique({
    where: {
      id,
    },
  });

  if (!chapter) {
    throw new AppError(404, "Chapter not found");
  }

  if (!data.name) {
    return prisma.chapter.update({
      where: {
        id,
      },
      data,
    });
  }

  const slug = generateSlug(data.name);

  if (slug !== chapter.slug) {
    const existingChapter = await prisma.chapter.findFirst({
      where: {
        classId: chapter.classId,
        slug,
        NOT: {
          id,
        },
      },
    });

    if (existingChapter) {
      throw new AppError(409, "Chapter with this name already exists in this class");
    }
  }

  return prisma.chapter.update({
    where: {
      id,
    },
    data: {
      ...data,
      slug,
    },
  });
};

export const deleteChapter = async (id: string) => {
  const chapter = await prisma.chapter.findUnique({
    where: {
      id,
    },
  });

  if (!chapter) {
    throw new AppError(404, "Chapter not found");
  }

  const [audioLectureCount, keywordRevisionCount] = await Promise.all([
    prisma.audioLecture.count({
      where: {
        chapterId: id,
      },
    }),

    prisma.keywordRevision.count({
      where: {
        chapterId: id,
      },
    }),
  ]);

  if (audioLectureCount > 0 || keywordRevisionCount > 0) {
    throw new AppError(
      409,
      "Chapter has audio lectures or keyword revisions. Delete them first",
    );
  }

  await prisma.chapter.delete({
    where: {
      id,
    },
  });
};
