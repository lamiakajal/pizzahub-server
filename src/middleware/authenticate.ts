import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { env } from "../config/env";
import { ROLES } from "../constants/roles";
import { User } from "../models/User";
import type { AuthUser } from "../types/auth";
import { ApiError } from "../utils/ApiError";
import { setRequestUser } from "../utils/requestUser";

type JwkItem = { kid?: string; kty?: string; [key: string]: unknown };

let cachedKeys: JwkItem[] = [];

async function fetchJwks(jwksUrl: string): Promise<JwkItem[]> {
  const res = await fetch(jwksUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS (${res.status})`);
  }
  const data = (await res.json()) as { keys?: JwkItem[] };
  cachedKeys = Array.isArray(data.keys) ? data.keys : [];
  return cachedKeys;
}

async function verifyJwtWithJwks(
  token: string,
  jwksUrl: string,
  issuer: string,
): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT");
  }

  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(
    Buffer.from(headerB64, "base64url").toString("utf8"),
  ) as { alg?: string; kid?: string };
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf8"),
  ) as Record<string, unknown>;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new Error("Token expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new Error("Token not active");
  }
  if (payload.iss !== issuer) {
    throw new Error(`Invalid issuer: ${String(payload.iss)}`);
  }

  let keys = cachedKeys;
  let jwk = keys.find((k) => !header.kid || k.kid === header.kid);
  if (!jwk) {
    keys = await fetchJwks(jwksUrl);
    jwk = keys.find((k) => !header.kid || k.kid === header.kid);
  }
  if (!jwk) {
    throw new Error("Matching JWK not found");
  }

  const pubKey = crypto.createPublicKey({
    key: jwk,
    format: "jwk",
  } as Parameters<typeof crypto.createPublicKey>[0]);
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(sigB64, "base64url");

  let verified = false;
  if (header.alg === "EdDSA" || jwk.kty === "OKP") {
    verified = crypto.verify(null, signingInput, pubKey, signature);
  } else if (header.alg === "ES256") {
    verified = crypto.verify(
      "sha256",
      signingInput,
      { key: pubKey, dsaEncoding: "ieee-p1363" },
      signature,
    );
  } else {
    verified = crypto.verify("sha256", signingInput, pubKey, signature);
  }

  if (!verified) {
    throw new Error("Invalid token signature");
  }

  return payload;
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
  const baseUrl = env.betterAuthUrl.replace(/\/+$/, "");

  let userId: string | undefined;
  try {
    const payload = await verifyJwtWithJwks(
      token,
      `${baseUrl}/api/auth/jwks`,
      baseUrl,
    );
    userId = (payload.sub ?? payload.id) as string | undefined;
  } catch (error) {
    console.warn("JWT verification failed:", (error as Error).message);
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
