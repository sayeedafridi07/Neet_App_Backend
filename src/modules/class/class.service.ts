import prisma from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { generateSlug } from "../../utils/slug.js";
import type { CreateClassData, UpdateClassData } from "./class.schema.js";

export const getClasses = async (
  page: number,
  limit: number,
  search?: string,
) => {
  const skip = (page - 1) * limit;

  const where = search
    ? {
        name: {
          contains: search,
          mode: "insensitive" as const,
        },
      }
    : undefined;

  const [classes, total] = await Promise.all([
    prisma.academicClass.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.academicClass.count({
      where,
    }),
  ]);

  return {
    classes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getClassById = async (id: string) => {
  return prisma.academicClass.findUnique({
    where: {
      id,
    },
  });
};

export const getClassBySlug = async (subjectId: string, slug: string) => {
  return prisma.academicClass.findFirst({
    where: {
      subjectId,
      slug,
    },
  });
};

export const createClass = async (data: CreateClassData) => {
  const subject = await prisma.subject.findUnique({
    where: {
      id: data.subjectId,
    },
  });

  if (!subject) {
    throw new AppError(404, "Subject not found");
  }

  const slug = generateSlug(data.name);

  const existingClass = await prisma.academicClass.findFirst({
    where: {
      subjectId: data.subjectId,
      slug,
    },
  });

  if (existingClass) {
    throw new AppError(409, "Class with this name already exists in this subject");
  }

  return prisma.academicClass.create({
    data: {
      name: data.name,
      slug,
      subjectId: data.subjectId,
    },
  });
};

export const updateClass = async (id: string, data: UpdateClassData) => {
  const academicClass = await prisma.academicClass.findUnique({
    where: {
      id,
    },
  });

  if (!academicClass) {
    throw new AppError(404, "Class not found");
  }

  return prisma.academicClass.update({
    where: {
      id,
    },
    data,
  });
};

export const deleteClass = async (id: string) => {
  const academicClass = await prisma.academicClass.findUnique({
    where: {
      id,
    },
  });

  if (!academicClass) {
    throw new AppError(404, "Class not found");
  }

  await prisma.academicClass.delete({
    where: {
      id,
    },
  });
};
