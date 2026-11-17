import prisma from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { generateSlug } from "../../utils/slug.js";
import type { CreateSubjectData, UpdateSubjectData } from "./subject.schema.js";

type SubjectCounts = {
  audioLectures: number;
  keywordRevisions: number;
  quizzes: number;
};

const attachCounts = async <T extends { id: string }>(
  subjects: T[],
): Promise<(T & { counts: SubjectCounts })[]> => {
  if (subjects.length === 0) return [];

  const chapters = await prisma.chapter.findMany({
    where: { subjectId: { in: subjects.map((s) => s.id) } },
    select: {
      subjectId: true,
      _count: {
        select: { audioLectures: true, keywordRevisions: true, quizzes: true },
      },
    },
  });

  const totals = new Map<string, SubjectCounts>();
  for (const { subjectId, _count } of chapters) {
    const t = totals.get(subjectId) ?? {
      audioLectures: 0,
      keywordRevisions: 0,
      quizzes: 0,
    };
    t.audioLectures += _count.audioLectures;
    t.keywordRevisions += _count.keywordRevisions;
    t.quizzes += _count.quizzes;
    totals.set(subjectId, t);
  }

  return subjects.map((s) => ({
    ...s,
    counts: totals.get(s.id) ?? {
      audioLectures: 0,
      keywordRevisions: 0,
      quizzes: 0,
    },
  }));
};

export const getSubjects = async (
  page: number,
  limit: number,
  search?: string,
) => {
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            phone: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            city: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            schoolName: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      }
    : undefined;

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.subject.count({
      where,
    }),
  ]);

  return {
    subjects: await attachCounts(subjects),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getSubjectById = async (id: string) => {
  const subject = await prisma.subject.findUnique({
    where: {
      id,
    },
  });

  if (!subject) return null;

  const [withCounts] = await attachCounts([subject]);
  return withCounts;
};

export const getSubjectBySlug = async (slug: string) => {
  const subject = await prisma.subject.findUnique({
    where: {
      slug,
    },
  });

  if (!subject) return null;

  const [withCounts] = await attachCounts([subject]);
  return withCounts;
};

export const createSubject = async (data: CreateSubjectData) => {
  const slug = generateSlug(data.name);

  const existingSubject = await prisma.subject.findUnique({
    where: {
      slug,
    },
  });

  if (existingSubject) {
    throw new AppError(409, "Subject with this name already exists");
  }

  return prisma.subject.create({
    data: {
      name: data.name,
      slug,
    },
  });
};

export const updateSubject = async (id: string, data: UpdateSubjectData) => {
  const subject = await prisma.subject.findUnique({
    where: {
      id,
    },
  });

  if (!subject) {
    throw new AppError(404, "Subject not found");
  }

  return prisma.subject.update({
    where: {
      id,
    },
    data,
  });
};

export const deleteSubject = async (id: string) => {
  const subject = await prisma.subject.findUnique({
    where: {
      id,
    },
  });

  if (!subject) {
    throw new AppError(404, "Subject not found");
  }

  await prisma.subject.delete({
    where: {
      id,
    },
  });
};
