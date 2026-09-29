import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { sendResponse } from "../utils/response.js";
import { discardUploadedFile } from "../config/multer.js";

export const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // multipart uploads are written to disk before this runs, so a rejected
      // payload would otherwise leave the file behind unreferenced
      void discardUploadedFile(req.file);

      return sendResponse(
        res,
        400,
        false,
        "Validation failed",
        null,
        result.error.issues.map((issue) => ({
          field: issue.path[0],
          message: issue.message,
        })),
      );
    }

    req.body = result.data;

    next();
  };
};
