import dotenv from "dotenv";

dotenv.config();

// Fail fast so a missing variable is caught at startup, not mid-request.
const required = ["MONGODB_URI", "CLIENT_URL", "BETTER_AUTH_URL"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

// CLIENT_URL can hold several comma separated origins. The first one is used for links.
const clientUrls = (process.env.CLIENT_URL as string)
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI as string,
  clientUrl: clientUrls[0],
  clientUrls,
  // Better Auth base URL: JWT issuer and JWKS host.
  betterAuthUrl: (process.env.BETTER_AUTH_URL as string).replace(/\/$/, ""),
  // Optional at startup: payment routes return a clear error when missing.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID ?? "",
  },
};
