import prisma from "../../config/prisma.js";

import { AppError } from "../../utils/app-error.js";

import { generateSlug } from "../../utils/slug.js";

import { getAudioKey, removeUploadedFile } from "../../config/multer.js";

import type {
  CreateAudioLectureData,
  UpdateAudioLectureData,
} from "./audio-lecture.schema.js";
import { getAudioDuration } from "../../utils/audio-duration.js";

type AudioLecturePatch = UpdateAudioLectureData & {
  slug?: string;
  audioKey?: string;
};

const getAudioUrl = (audioKey: string) => {
  return `${process.env.BASE_URL}/uploads/${audioKey}`;
};

const formatAudioLecture = (audioLecture: any) => {
  const { audioKey, ...lecture } = audioLecture;

  return {
    ...lecture,
    audioUrl: getAudioUrl(audioKey),
  };
};

export const getAudioLectures = async (
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

  const [audioLectures, total] = await Promise.all([
    prisma.audioLecture.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        order: "asc",
      },
    }),

    prisma.audioLecture.count({
      where,
    }),
  ]);

  return {
    audioLectures: audioLectures.map(formatAudioLecture),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getAudioLectureById = async (id: string) => {
  const audioLecture = await prisma.audioLecture.findUnique({
    where: {
      id,
    },
  });

  if (!audioLecture) {
    throw new AppError(404, "Audio lecture not found");
  }

  return formatAudioLecture(audioLecture);
};

export const getAudioLectureBySlug = async (
  chapterId: string,
  slug: string,
) => {
  const audioLecture = await prisma.audioLecture.findFirst({
    where: {
      chapterId,
      slug,
    },
  });

  if (!audioLecture) {
    throw new AppError(404, "Audio lecture not found");
  }

  return formatAudioLecture(audioLecture);
};

export const createAudioLecture = async (
  data: CreateAudioLectureData,
  file?: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError(400, "Audio file is required");
  }

  const audioKey = getAudioKey(file);

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

    const existingLecture = await prisma.audioLecture.findFirst({
      where: {
        chapterId: data.chapterId,
        slug,
      },
    });

    if (existingLecture) {
      throw new AppError(
        409,
        "Audio lecture with this title already exists in this chapter",
      );
    }

    const duration = await getAudioDuration(file.path);

    const audioLecture = await prisma.audioLecture.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        audioKey,
        duration,
        order: data.order,
        isActive: data.isActive,
        chapterId: data.chapterId,
      },
    });

    return formatAudioLecture(audioLecture);
  } catch (error) {
    await removeUploadedFile(audioKey);
    throw error;
  }
};

export const updateAudioLecture = async (
  id: string,
  data: UpdateAudioLectureData,
  file?: Express.Multer.File,
) => {
  const newAudioKey = file ? getAudioKey(file) : undefined;

  let updateSuccessful = false;

  try {
    const audioLecture = await prisma.audioLecture.findUnique({
      where: {
        id,
      },
    });

    if (!audioLecture) {
      throw new AppError(404, "Audio lecture not found");
    }

    const patch: AudioLecturePatch = {
      ...data,
    };

    if (data.title) {
      const slug = generateSlug(data.title);

      if (slug !== audioLecture.slug) {
        const existingLecture = await prisma.audioLecture.findFirst({
          where: {
            chapterId: audioLecture.chapterId,
            slug,
            NOT: {
              id,
            },
          },
        });

        if (existingLecture) {
          throw new AppError(
            409,
            "Audio lecture with this title already exists in this chapter",
          );
        }
      }

      patch.slug = slug;
    }

    if (newAudioKey) {
      patch.audioKey = newAudioKey;
    }

    const updated = await prisma.audioLecture.update({
      where: {
        id,
      },
      data: patch,
    });

    updateSuccessful = true;

    // Delete old file only after DB update succeeds
    if (newAudioKey && audioLecture.audioKey !== newAudioKey) {
      await removeUploadedFile(audioLecture.audioKey);
    }

    return formatAudioLecture(updated);
  } catch (error) {
    // Only delete newly uploaded file if DB update failed
    if (newAudioKey && !updateSuccessful) {
      await removeUploadedFile(newAudioKey);
    }

    throw error;
  }
};

export const deleteAudioLecture = async (id: string) => {
  const audioLecture = await prisma.audioLecture.findUnique({
    where: {
      id,
    },
  });

  if (!audioLecture) {
    throw new AppError(404, "Audio lecture not found");
  }

  await prisma.audioLecture.delete({
    where: {
      id,
    },
  });

  await removeUploadedFile(audioLecture.audioKey);
};
