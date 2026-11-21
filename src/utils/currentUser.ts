import type { Request } from "express";
import { ApiError } from "./ApiError";
import { getRequestUser } from "./requestUser";

// Routes behind authenticate always have a user; this keeps the types honest.
export function currentUser(req: Request) {
  const user = getRequestUser(req);
  if (!user) throw new ApiError(401, "Authentication required");
  return user;
}
