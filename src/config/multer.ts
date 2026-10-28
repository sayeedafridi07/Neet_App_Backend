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

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

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

export const IMAGE_UPLOAD_DIR = "images";
export const IMAGE_FIELD_NAME = "image";

const IMAGE_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export const getImageKey = (file: Express.Multer.File) => {
  return path.posix.join(IMAGE_UPLOAD_DIR, file.filename);
};

export const getUploadUrl = (key: string) => {
  return `${process.env.BASE_URL}/uploads/${key}`;
};

// Audio and images share one storage so a request can carry both.
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const dir = path.join(
      getUploadRoot(),
      file.fieldname === IMAGE_FIELD_NAME ? IMAGE_UPLOAD_DIR : AUDIO_UPLOAD_DIR,
    );

    fs.mkdir(dir, { recursive: true }, (error) => {
      if (error) {
        return cb(error, dir);
      }

      cb(null, dir);
    });
  },

  filename: (_req, file, cb) => {
    if (file.fieldname === IMAGE_FIELD_NAME) {
      // The extension comes from the validated mime type, never the client name.
      return cb(
        null,
        `${crypto.randomBytes(16).toString("hex")}${IMAGE_MIME_TYPES[file.mimetype]}`,
      );
    }

    cb(null, sanitizeFilename(file.originalname));
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (file.fieldname === IMAGE_FIELD_NAME) {
    if (!IMAGE_MIME_TYPES[file.mimetype]) {
      return cb(
        new AppError(
          415,
          `Unsupported image type: ${file.mimetype}. Use JPEG, PNG, WebP or GIF`,
        ),
      );
    }

    return cb(null, true);
  }

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
    files: 2,
  },
}).fields([
  { name: AUDIO_FIELD_NAME, maxCount: 1 },
  { name: IMAGE_FIELD_NAME, maxCount: 1 },
]);

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
}).single(IMAGE_FIELD_NAME);

export const getUploadedFile = (req: Request, field: string) => {
  if (req.file?.fieldname === field) {
    return req.file;
  }

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  return files?.[field]?.[0];
};

const getUploadedFiles = (req: Request) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  return [
    ...(req.file ? [req.file] : []),
    ...Object.values(files ?? {}).flat(),
  ];
};

const toUploadError = (
  error: unknown,
  maxSize: number,
  allowedFields: string,
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new AppError(
        413,
        `File exceeds the ${Math.floor(maxSize / 1024 / 1024)}MB limit`,
      );
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return new AppError(
        400,
        `Unexpected file field "${error.field}". Allowed fields: ${allowedFields}.`,
      );
    }

    return new AppError(400, error.message);
  }

  return error;
};

export const handleAudioUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadAudio(req, res, async (error: unknown) => {
    if (error) {
      await discardUploadedFiles(req);

      return next(
        toUploadError(
          error,
          MAX_FILE_SIZE,
          `"${AUDIO_FIELD_NAME}", "${IMAGE_FIELD_NAME}"`,
        ),
      );
    }

    // The size limit is shared with the audio, so check images separately
    const image = getUploadedFile(req, IMAGE_FIELD_NAME);

    if (image && image.size > MAX_IMAGE_SIZE) {
      await discardUploadedFiles(req);

      return next(
        new AppError(
          413,
          `Image exceeds the ${Math.floor(MAX_IMAGE_SIZE / 1024 / 1024)}MB limit`,
        ),
      );
    }

    next();
  });
};

export const handleImageUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadImage(req, res, (error: unknown) => {
    if (error) {
      return next(
        toUploadError(error, MAX_IMAGE_SIZE, `"${IMAGE_FIELD_NAME}"`),
      );
    }

    next();
  });
};

export const removeUploadedFile = async (key: string) => {
  const uploadRoot = getUploadRoot();
  const filePath = path.resolve(uploadRoot, key);

  if (!filePath.startsWith(uploadRoot + path.sep)) {
    console.warn(`⚠️ Refusing to delete outside upload root: ${key}`);
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      console.warn(`⚠️ Failed to delete ${key}:`, error);
    }
  }
};

export const discardUploadedFiles = async (req: Request) => {
  await Promise.all(
    getUploadedFiles(req).map((file) =>
      removeUploadedFile(
        file.fieldname === IMAGE_FIELD_NAME
          ? getImageKey(file)
          : getAudioKey(file),
      ),
    ),
  );
};

/* -------------------------------------------------------------------------- */
/* QUESTION DOCUMENTS                                                         */
/* -------------------------------------------------------------------------- */

export const DOCUMENT_FIELD_NAME = "file";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

// Kept in memory: the document is parsed once and never stored.
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    // Some clients send docx as octet-stream, so fall back to the extension.
    const isDocx =
      file.mimetype === DOCX_MIME_TYPE ||
      path.extname(file.originalname).toLowerCase() === ".docx";

    if (!isDocx) {
      return cb(new AppError(415, "Only .docx files are supported"));
    }

    cb(null, true);
  },
  limits: {
    fileSize: MAX_DOCUMENT_SIZE,
    files: 1,
  },
}).single(DOCUMENT_FIELD_NAME);

export const handleDocumentUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadDocument(req, res, (error: unknown) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError(
            413,
            `Document exceeds the ${Math.floor(MAX_DOCUMENT_SIZE / 1024 / 1024)}MB limit`,
          ),
        );
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new AppError(
            400,
            `Unexpected file field "${error.field}". Upload the document as "${DOCUMENT_FIELD_NAME}".`,
          ),
        );
      }

      return next(new AppError(400, error.message));
    }

    return next(error);
  });
};
