import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";
import type { Request, Response, NextFunction } from "express";

import { AppError } from "../utils/app-error.js";

export const AUDIO_UPLOAD_DIR = "audio";
export const AUDIO_FIELD_NAME = "audio";

export const getAudioKey = (file: Express.Multer.File) => {
  return path.posix.join(AUDIO_UPLOAD_DIR, file.filename);
};

export const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
] as const;

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const getUploadRoot = () => {
  return path.resolve(process.cwd(), "uploads");
};

export const getAudioUploadDir = () => {
  return path.join(getUploadRoot(), AUDIO_UPLOAD_DIR);
};

const resolveExtension = (file: Express.Multer.File) => {
  const fromName = path.extname(file.originalname).toLowerCase();

  if (fromName && /^\.[a-z0-9]{1,5}$/.test(fromName)) {
    return fromName;
  }

  const fromMime: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/webm": ".weba",
    "audio/ogg": ".ogg",
  };

  return fromMime[file.mimetype] ?? ".mp3";
};

const sanitizeFilename = (filename: string) => {
  const extension = path.extname(filename).toLowerCase();

  const name = path
    .basename(filename, extension)
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${crypto.randomBytes(8).toString("hex")}_${name}${extension}`;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = getAudioUploadDir();

    fs.mkdir(dir, { recursive: true }, (error) => {
      if (error) {
        return cb(error, dir);
      }

      cb(null, dir);
    });
  },

  filename: (_req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (
    !AUDIO_MIME_TYPES.includes(
      file.mimetype as (typeof AUDIO_MIME_TYPES)[number],
    )
  ) {
    return cb(new AppError(415, `Unsupported audio type: ${file.mimetype}`));
  }

  cb(null, true);
};

export const MAX_AUDIO_FILE_SIZE = MAX_FILE_SIZE;

export const uploadAudio = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
}).single(AUDIO_FIELD_NAME);

export const handleAudioUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadAudio(req, res, (error: unknown) => {
    if (!error) {
      return next();
    }

    if (error instanceof AppError) {
      return next(error);
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError(
            413,
            `Audio file exceeds the ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB limit`,
          ),
        );
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new AppError(
            400,
            `Unexpected file field "${error.field}". Upload the audio as "${AUDIO_FIELD_NAME}".`,
          ),
        );
      }

      return next(new AppError(400, error.message));
    }

    return next(error);
  });
};

export const removeUploadedFile = async (audioKey: string) => {
  const uploadRoot = getUploadRoot();
  const filePath = path.resolve(uploadRoot, audioKey);

  if (!filePath.startsWith(uploadRoot + path.sep)) {
    console.warn(`⚠️ Refusing to delete outside upload root: ${audioKey}`);
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      console.warn(`⚠️ Failed to delete ${audioKey}:`, error);
    }
  }
};

export const discardUploadedFile = async (file?: Express.Multer.File) => {
  if (!file) {
    return;
  }

  await removeUploadedFile(getAudioKey(file));
};
