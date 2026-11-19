import type { AuthUser } from "../types/auth";

// Premium counts only while it has not expired.
export function isPremiumActive(
  user: Pick<AuthUser, "subscriptionPlan" | "subscriptionExpiresAt">
) {
  if (user.subscriptionPlan !== "premium") return false;
  if (!user.subscriptionExpiresAt) return true;
  return user.subscriptionExpiresAt.getTime() > Date.now();
}
