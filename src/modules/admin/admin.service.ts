import prisma from "../../config/prisma.js";
import bcrypt from "bcrypt";
import { AppError } from "../../utils/app-error.js";
import type { CreateAdminData, UpdateAdminData } from "./admin.schema.js";

export const getAdmins = async (
  page: number,
  limit: number,
  search?: string,
) => {
  const skip = (page - 1) * limit;

  const where = {
    role: "ADMIN" as const,
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.admin.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      omit: {
        password: true,
        accessToken: true,
      },
    }),

    prisma.admin.count({
      where,
    }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getAdminById = async (id: string) => {
  return prisma.admin.findUnique({
    where: {
      id,
    },
    omit: {
      password: true,
      accessToken: true,
    },
  });
};

export const createAdmin = async (data: CreateAdminData) => {
  const existingUser = await prisma.admin.findUnique({
    where: {
      email: data.email,
    },
  });

  if (existingUser) {
    throw new AppError(409, "Email already in use");
  }

  const { password } = data;

  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.admin.create({
    data: {
      ...data,
      password: hashedPassword,
    },
    omit: {
      password: true,
      accessToken: true,
    },
  });
};

export const updateAdmin = async (id: string, data: UpdateAdminData) => {
  const admin = await prisma.admin.findUnique({
    where: {
      id,
    },
  });

  if (!admin) {
    throw new AppError(404, "Admin not found");
  }

  return prisma.admin.update({
    where: {
      id,
    },
    omit: {
      password: true,
      accessToken: true,
    },
    data,
  });
};

export const toggleStatus = async (id: string) => {
  const admin = await prisma.admin.findUnique({
    where: {
      id,
    },
  });

  if (!admin) {
    throw new AppError(404, "Admin not found");
  }

  return prisma.admin.update({
    where: {
      id,
    },
    omit: {
      password: true,
      accessToken: true,
    },
    data: {
      isActive: !admin.isActive,
    },
  });
};

export const deleteAdmin = async (id: string) => {
  const admin = await prisma.admin.findUnique({
    where: {
      id,
    },
  });

  if (!admin) {
    throw new AppError(404, "Admin not found");
  }

  await prisma.admin.delete({
    where: {
      id,
    },
  });
};
