import fs from "node:fs";
import {
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const bucket = process.env.R2_BUCKET_NAME;

const validateKey = (key: string) => {
  if (!/^(images|audio)\/.+/.test(key)) {
    throw new Error("Invalid R2 object key");
  }
};

// `body` is either a local file path (streamed) or an in-memory buffer.
export const uploadFile = async (
  body: string | Buffer,
  key: string,
  contentType: string,
) => {
  validateKey(key);

  const upload = new Upload({
    client: r2,
    params: {
      Bucket: bucket,
      Key: key,
      Body: typeof body === "string" ? fs.createReadStream(body) : body,
      ContentType: contentType,
      // Keys are random and never reused, so they can be cached forever.
      CacheControl: "public, max-age=31536000, immutable",
    },
    leavePartsOnError: false,
  });

  await upload.done();

  return key;
};

export const deleteFile = async (key: string) => {
  validateKey(key);

  await r2.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
};

export const getPublicUrl = (key: string) => {
  validateKey(key);

  return `${(process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "")}/${key}`;
};
