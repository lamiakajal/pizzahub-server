import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { env } from "../config/env";
import { ROLES } from "../constants/roles";
import { User } from "../models/User";
import type { AuthUser } from "../types/auth";
import { ApiError } from "../utils/ApiError";
import { setRequestUser } from "../utils/requestUser";

const importJose = new Function('return import("jose")') as () => Promise<
  typeof import("jose")
>;

let cachedJwks: ReturnType<
  (typeof import("jose"))["createRemoteJWKSet"]
> | null = null;

async function getJose() {
  const jose = await importJose();
  if (!cachedJwks) {
    cachedJwks = jose.createRemoteJWKSet(
      new URL(`${env.betterAuthUrl}/api/auth/jwks`),
    );
  }
  return { jwtVerify: jose.jwtVerify, jwks: cachedJwks };
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication token is missing");
  }

  const token = header.slice("Bearer ".length).trim();

  let userId: string | undefined;
  try {
    const { jwtVerify, jwks } = await getJose();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.betterAuthUrl,
    });
    userId = (payload.sub ?? (payload as Record<string, unknown>).id) as
      | string
      | undefined;
  } catch (error) {
    console.warn(
      "JWT verification failed:",
      (error as Error).message,
      "issuer:",
      env.betterAuthUrl,
    );
    throw new ApiError(401, "Invalid or expired token");
  }

  if (!userId || !isValidObjectId(userId)) {
    throw new ApiError(401, "Invalid token payload");
  }

  // Never trust role or block status from the token. Always read the database.
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  const authUser: AuthUser = {
    id: String(user._id),
    name: user.name ?? "",
    email: user.email ?? "",
    role: ROLES.includes(user.role as (typeof ROLES)[number])
      ? (user.role as AuthUser["role"])
      : "customer",
    isBlocked: Boolean(user.isBlocked),
    subscriptionPlan: user.subscriptionPlan === "premium" ? "premium" : "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
  };

  setRequestUser(req, authUser);
  next();
}
