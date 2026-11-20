// Fields the admin user list reads. Everything else stays in the database.
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

// Fields that were never set come back as null or missing from .lean().
type UserDoc = {
  _id: unknown;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
  isBlocked?: boolean | null;
  businessName?: string | null;
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: Date | null;
  createdAt?: Date | null;
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
