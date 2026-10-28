import prisma from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { generateSlug } from "../../utils/slug.js";
import type { CreateChapterData, UpdateChapterData } from "./chapter.schema.js";

export const getChapters = async (
  page: number,
  limit: number,
  search?: string,
  classId?: string,
  subjectId?: string,
) => {
  const skip = (page - 1) * limit;

  const where = {
    ...(classId ? { classId } : {}),
    ...(subjectId ? { subjectId } : {}),

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

const chapterCountsInclude = {
  _count: {
    select: {
      audioLectures: true,
      keywordRevisions: true,
      quizzes: true,
    },
  },
} as const;

export const getChapterById = async (id: string) => {
  return prisma.chapter.findUnique({
    where: {
      id,
    },
    include: chapterCountsInclude,
  });
};

export const getChapterBySlug = async (slug: string) => {
  return prisma.chapter.findFirst({
    where: {
      slug,
    },
    include: chapterCountsInclude,
  });
};

export const createChapter = async (data: CreateChapterData) => {
  const [academicClass, subject] = await Promise.all([
    prisma.academicClass.findUnique({
      where: {
        id: data.classId,
      },
    }),
    prisma.subject.findUnique({
      where: {
        id: data.subjectId,
      },
    }),
  ]);

  if (!academicClass) {
    throw new AppError(404, "Class not found");
  }

  if (!subject) {
    throw new AppError(404, "Subject not found");
  }

  const slug = generateSlug(data.name);

  const existingChapter = await prisma.chapter.findFirst({
    where: {
      classId: data.classId,
      subjectId: data.subjectId,
      slug,
    },
  });

  if (existingChapter) {
    throw new AppError(409, "Chapter with this name already exists in this class and subject");
  }

  return prisma.chapter.create({
    data: {
      name: data.name,
      slug,
      order: data.order,
      classId: data.classId,
      subjectId: data.subjectId,
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

  const newClassId = (data as any).classId ?? chapter.classId;
  const newSubjectId = (data as any).subjectId ?? chapter.subjectId;

  if ((data as any).classId) {
    const academicClass = await prisma.academicClass.findUnique({
      where: {
        id: (data as any).classId,
      },
    });
    if (!academicClass) {
      throw new AppError(404, "Class not found");
    }
  }

  if ((data as any).subjectId) {
    const subject = await prisma.subject.findUnique({
      where: {
        id: (data as any).subjectId,
      },
    });
    if (!subject) {
      throw new AppError(404, "Subject not found");
    }
  }

  let slug = chapter.slug;
  if ((data as any).name) {
    slug = generateSlug((data as any).name);
    const existingChapter = await prisma.chapter.findFirst({
      where: {
        classId: newClassId,
        subjectId: newSubjectId,
        slug,
        NOT: {
          id,
        },
      },
    });

    if (existingChapter) {
      throw new AppError(409, "Chapter with this name already exists in this class and subject");
    }
  } else if ((data as any).classId || (data as any).subjectId) {
    const existingChapter = await prisma.chapter.findFirst({
      where: {
        classId: newClassId,
        subjectId: newSubjectId,
        slug,
        NOT: {
          id,
        },
      },
    });

    if (existingChapter) {
      throw new AppError(409, "Chapter with this name already exists in this class and subject");
    }
  }

  const updateData: any = { ...data };
  if ((data as any).name) {
    updateData.slug = slug;
  }

  return prisma.chapter.update({
    where: {
      id,
    },
    data: updateData,
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
