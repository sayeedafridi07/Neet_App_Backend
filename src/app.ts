import express from "express";
import cors from "cors";
import helmet from "helmet";

import routes from "./routes/index.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { sendResponse } from "./utils/response.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  sendResponse(res, 200, true, "NEET Backend is running");
});

app.use("/api/v1", routes);

app.use(errorMiddleware);
app.use(notFoundMiddleware);

export default app;
