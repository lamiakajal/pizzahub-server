import type { NextFunction, Request, Response } from "express";
import type { Role } from "../constants/roles";
import { ApiError } from "../utils/ApiError";
import { getRequestUser } from "../utils/requestUser";

// Use after authenticate: allows the request only for the listed roles.
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = getRequestUser(req);

    if (!user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!allowed.includes(user.role)) {
      return next(
        new ApiError(403, "You do not have permission to perform this action")
      );
    }

    next();
  };
}
