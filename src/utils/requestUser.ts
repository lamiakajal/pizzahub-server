import type { Request } from "express";
import type { AuthUser } from "../types/auth";

// The verified user is stored on the request through these helpers
// instead of a global Express type augmentation.
type RequestWithUser = Request & { user?: AuthUser };

export function setRequestUser(req: Request, user: AuthUser) {
  (req as RequestWithUser).user = user;
}

export function getRequestUser(req: Request): AuthUser | undefined {
  return (req as RequestWithUser).user;
}
