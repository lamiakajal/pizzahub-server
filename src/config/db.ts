import mongoose from "mongoose";
import { env } from "./env";

let connection: Promise<typeof mongoose> | null = null;

export function connectDB() {
  if (!connection) {
    connection = mongoose
      .connect(env.mongoUri, { dbName: "pizzahub" })
      .catch((error) => {
        connection = null;
        throw error;
      });
  }
  return connection;
}
