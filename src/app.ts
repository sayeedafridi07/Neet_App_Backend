import express from "express";
import cors from "cors";
import helmet from "helmet";

import routes from "./routes/index.js";

import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { sendResponse } from "./utils/response.js";

import { getUploadRoot } from "./config/multer.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  sendResponse(res, 200, true, "NEET Backend is running");
});

// Static files
app.use("/uploads", express.static(getUploadRoot()));

// API routes
app.use("/api/v1", routes);

// Error handlers
app.use(errorMiddleware);
app.use(notFoundMiddleware);

export default app;