import dotenv from "dotenv";

dotenv.config();

// Fail fast so a missing variable is caught at startup, not mid-request.
const required = ["MONGODB_URI", "CLIENT_URL", "BETTER_AUTH_URL"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI as string,
  clientUrl: process.env.CLIENT_URL as string,
  // Base URL of the Better Auth instance (the Next.js app).
  // Used as the JWT issuer and as the host of the public key set.
  betterAuthUrl: (process.env.BETTER_AUTH_URL as string).replace(/\/$/, ""),
};
