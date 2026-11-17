import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/errorHandler";
import healthRouter from "./routes/health";
import meRouter from "./routes/me";

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/me", meRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
