import type { Role, SubscriptionPlan } from "../constants/roles";

// The verified user attached to a request after authentication.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isBlocked: boolean;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt: Date | null;
}
