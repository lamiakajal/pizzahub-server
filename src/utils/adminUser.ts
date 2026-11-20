// Safe fields an admin may see about a user. Nothing else from the
// "user" collection (sessions, tokens, phone, ...) is ever returned.
export const ADMIN_USER_FIELDS = {
  name: 1,
  email: 1,
  image: 1,
  role: 1,
  isBlocked: 1,
  businessName: 1,
  subscriptionPlan: 1,
  subscriptionExpiresAt: 1,
  createdAt: 1,
} as const;

type UserDoc = {
  _id: unknown;
  name?: string;
  email?: string;
  image?: string | null;
  role?: string;
  isBlocked?: boolean;
  businessName?: string;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: Date | null;
  createdAt?: Date;
};

export function toAdminUser(user: UserDoc) {
  return {
    id: String(user._id),
    name: user.name ?? "",
    email: user.email ?? "",
    image: user.image ?? null,
    role: user.role ?? "customer",
    isBlocked: Boolean(user.isBlocked),
    businessName: user.businessName ?? null,
    subscriptionPlan: user.subscriptionPlan ?? "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
    createdAt: user.createdAt ?? null,
  };
}
