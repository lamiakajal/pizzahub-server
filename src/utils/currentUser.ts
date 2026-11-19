import type { Request } from "express";
import { ApiError } from "./ApiError";

// Routes behind authenticate always have req.user; this keeps the types honest.
export function currentUser(req: Request) {
  if (!req.user) throw new ApiError(401, "Authentication required");
  return req.user;
}
