import prisma from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { generateSlug } from "../../utils/slug.js";
import type { CreateSubjectData, UpdateSubjectData } from "./subject.schema.js";

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
    subjects,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getSubjectById = async (id: string) => {
  return prisma.subject.findUnique({
    where: {
      id,
    },
  });
};

export const getSubjectBySlug = async (slug: string) => {
  return prisma.subject.findUnique({
    where: {
      slug,
    },
  });
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
