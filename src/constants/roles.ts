export const ROLES = ["customer", "vendor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const SUBSCRIPTION_PLANS = ["free", "premium"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
