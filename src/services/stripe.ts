import Stripe from "stripe";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

let client: Stripe | null = null;

// Created on first use, so the server starts fine without Stripe keys.
export function getStripe() {
  if (!env.stripe.secretKey) {
    throw new ApiError(500, "Payments are not configured yet");
  }
  if (!client) client = new Stripe(env.stripe.secretKey);
  return client;
}

export function getPremiumPriceId() {
  if (!env.stripe.premiumPriceId) {
    throw new ApiError(500, "The Premium plan is not configured yet");
  }
  return env.stripe.premiumPriceId;
}
