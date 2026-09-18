import prisma from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import type { CreateUserData, UpdateUserData } from "./user.schema.js";

// export const getUsers = async () => {
//   return prisma.user.findMany({
//     orderBy: {
//       createdAt: "desc",
//     },
//   });
// };

export const getUsers = async (
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

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      omit: {
        accessToken: true,
      },
    }),

    prisma.user.count({
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

export const getUserById = async (id: string) => {
  return prisma.user.findUnique({
    where: {
      id,
    },
    omit: {
      accessToken: true,
    },
  });
};

export const createUser = async (data: CreateUserData) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      phone: data.phone,
    },
  });

  if (existingUser) {
    throw new AppError(409, "Phone number already in use");
  }

  return prisma.user.create({
    data: {
      ...data,
      profileComplete: true,
    },
    omit: {
      accessToken: true,
    },
  });
};

export const updateUser = async (id: string, data: UpdateUserData) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return prisma.user.update({
    where: {
      id,
    },
    omit: {
      accessToken: true,
    },
    data,
  });
};

export const toggleStatus = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return prisma.user.update({
    where: {
      id,
    },
    omit: {
      accessToken: true,
    },
    data: {
      isActive: !user.isActive,
    },
  });
};

export const resetDevice = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return prisma.user.update({
    where: {
      id,
    },
    omit: {
      accessToken: true,
    },
    data: {
      deviceId: null,
    },
  });
};

export const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  await prisma.user.delete({
    where: {
      id,
    },
  });
};
