import type { Request } from "express";
import type { AuthUser } from "../types/auth";

// The verified user travels on the request. It is written and read through these
// two functions instead of a global Express type augmentation, so the code
// type-checks the same way on every machine and on the build server.
type RequestWithUser = Request & { user?: AuthUser };

export function setRequestUser(req: Request, user: AuthUser) {
  (req as RequestWithUser).user = user;
}

export function getRequestUser(req: Request): AuthUser | undefined {
  return (req as RequestWithUser).user;
}
