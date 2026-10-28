import prisma from "../../config/prisma.js";

import { AppError } from "../../utils/app-error.js";

import { generateSlug } from "../../utils/slug.js";

import {
  getAudioKey,
  getImageKey,
  getUploadUrl,
  removeUploadedFile,
} from "../../config/multer.js";

import type {
  CreateKeywordRevisionData,
  UpdateKeywordRevisionData,
} from "./keyword-revision.schema.js";

type KeywordRevisionPatch = Omit<UpdateKeywordRevisionData, "removeImage"> & {
  slug?: string;
  audioKey?: string;
  imageKey?: string | null;
};

const formatKeywordRevision = (keywordRevision: any) => {
  const { audioKey, imageKey, ...revision } = keywordRevision;

  return {
    ...revision,
    audioUrl: getUploadUrl(audioKey),
    imageUrl: imageKey ? getUploadUrl(imageKey) : null,
  };
};

export const getKeywordRevisions = async (
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

  const [keywordRevisions, total] = await Promise.all([
    prisma.keywordRevision.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        order: "asc",
      },
    }),

    prisma.keywordRevision.count({
      where,
    }),
  ]);

  return {
    keywordRevisions: keywordRevisions.map(formatKeywordRevision),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getKeywordRevisionById = async (id: string) => {
  const keywordRevision = await prisma.keywordRevision.findUnique({
    where: {
      id,
    },
  });

  if (!keywordRevision) {
    throw new AppError(404, "Keyword revision not found");
  }

  return formatKeywordRevision(keywordRevision);
};

export const getKeywordRevisionBySlug = async (
  chapterId: string,
  slug: string,
) => {
  const keywordRevision = await prisma.keywordRevision.findFirst({
    where: {
      chapterId,
      slug,
    },
  });

  if (!keywordRevision) {
    throw new AppError(404, "Keyword revision not found");
  }

  return formatKeywordRevision(keywordRevision);
};

export const createKeywordRevision = async (
  data: CreateKeywordRevisionData,
  file?: Express.Multer.File,
  image?: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError(400, "Audio file is required");
  }

  const audioKey = getAudioKey(file);
  const imageKey = image ? getImageKey(image) : undefined;

  try {
    const chapter = await prisma.chapter.findUnique({
      where: {
        id: data.chapterId,
      },
    });

    if (!chapter) {
      throw new AppError(404, "Chapter not found");
    }

    const slug = generateSlug(data.title);

    const existingRevision =
      await prisma.keywordRevision.findFirst({
        where: {
          chapterId: data.chapterId,
          slug,
        },
      });

    if (existingRevision) {
      throw new AppError(
        409,
        "Keyword revision with this title already exists in this chapter",
      );
    }

    const keywordRevision =
      await prisma.keywordRevision.create({
        data: {
          title: data.title,
          slug,
          description: data.description,
          audioKey,
          imageKey,
          duration: data.duration,
          order: data.order,
          isActive: data.isActive,
          chapterId: data.chapterId,
        },
      });

    return formatKeywordRevision(keywordRevision);
  } catch (error) {
    await removeUploadedFile(audioKey);

    if (imageKey) {
      await removeUploadedFile(imageKey);
    }

    throw error;
  }
};

export const updateKeywordRevision = async (
  id: string,
  data: UpdateKeywordRevisionData,
  file?: Express.Multer.File,
  image?: Express.Multer.File,
) => {
  const newAudioKey = file
    ? getAudioKey(file)
    : undefined;
  const newImageKey = image ? getImageKey(image) : undefined;

  if (!file && !image && Object.keys(data).length === 0) {
    throw new AppError(400, "At least one field is required");
  }

  let updateSuccessful = false;

  try {
    const keywordRevision =
      await prisma.keywordRevision.findUnique({
        where: {
          id,
        },
      });

    if (!keywordRevision) {
      throw new AppError(404, "Keyword revision not found");
    }

    const { removeImage, ...fields } = data;

    const patch: KeywordRevisionPatch = {
      ...fields,
    };

    if (data.title) {
      const slug = generateSlug(data.title);

      if (slug !== keywordRevision.slug) {
        const existingRevision =
          await prisma.keywordRevision.findFirst({
            where: {
              chapterId: keywordRevision.chapterId,
              slug,
              NOT: {
                id,
              },
            },
          });

        if (existingRevision) {
          throw new AppError(
            409,
            "Keyword revision with this title already exists in this chapter",
          );
        }
      }

      patch.slug = slug;
    }

    if (newAudioKey) {
      patch.audioKey = newAudioKey;
    }

    if (newImageKey) {
      patch.imageKey = newImageKey;
    } else if (removeImage) {
      patch.imageKey = null;
    }

    const updated =
      await prisma.keywordRevision.update({
        where: {
          id,
        },
        data: patch,
      });

    updateSuccessful = true;

    if (keywordRevision.imageKey && keywordRevision.imageKey !== updated.imageKey) {
      await removeUploadedFile(keywordRevision.imageKey);
    }

    // Delete old file only after DB update succeeds
    if (
      newAudioKey &&
      keywordRevision.audioKey !== newAudioKey
    ) {
      await removeUploadedFile(
        keywordRevision.audioKey,
      );
    }

    return formatKeywordRevision(updated);
  } catch (error) {
    // Only delete newly uploaded file if DB update failed
    if (newAudioKey && !updateSuccessful) {
      await removeUploadedFile(newAudioKey);
    }

    if (newImageKey && !updateSuccessful) {
      await removeUploadedFile(newImageKey);
    }

    throw error;
  }
};

export const toggleStatus = async (id: string) => {
  const keywordRevision =
    await prisma.keywordRevision.findUnique({
      where: {
        id,
      },
    });

  if (!keywordRevision) {
    throw new AppError(404, "Keyword revision not found");
  }

  const updated = await prisma.keywordRevision.update({
    where: {
      id,
    },
    data: {
      isActive: !keywordRevision.isActive,
    },
  });

  return formatKeywordRevision(updated);
};

export const deleteKeywordRevision = async (
  id: string,
) => {
  const keywordRevision =
    await prisma.keywordRevision.findUnique({
      where: {
        id,
      },
    });

  if (!keywordRevision) {
    throw new AppError(
      404,
      "Keyword revision not found",
    );
  }

  await prisma.keywordRevision.delete({
    where: {
      id,
    },
  });

  await removeUploadedFile(keywordRevision.audioKey);

  if (keywordRevision.imageKey) {
    await removeUploadedFile(keywordRevision.imageKey);
  }
};
