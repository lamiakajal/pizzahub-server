import { ACTIVE_MENU_STATUSES, FREE_PLAN_ITEM_LIMIT } from "../constants/menu";
import { MenuItem } from "../models/MenuItem";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";

const DAY_MS = 24 * 60 * 60 * 1000;

// Stripe moved the period end between API versions, so read both places.
export function periodEnd(subscription: unknown): Date | null {
  const sub = subscription as {
    current_period_end?: number;
    items?: { data?: { current_period_end?: number }[] };
  } | null;
  const seconds = sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

// The subscription of an invoice is a plain field on older API versions
// and lives under parent.subscription_details on newer ones.
export function invoiceSubscriptionId(invoice: unknown): string | null {
  type Ref = string | { id: string } | null | undefined;
  const data = invoice as {
    subscription?: Ref;
    parent?: { subscription_details?: { subscription?: Ref } | null } | null;
  };
  const ref = data.subscription ?? data.parent?.subscription_details?.subscription;
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export async function activatePremium(
  vendorId: string,
  details: {
    expiresAt: Date | null;
    customerId: string | null;
    subscriptionId: string | null;
  }
) {
  const set: Record<string, unknown> = {
    subscriptionPlan: "premium",
    // If Stripe gave no date, grant a month. The next invoice event corrects it.
    subscriptionExpiresAt: details.expiresAt ?? new Date(Date.now() + 31 * DAY_MS),
    stripeCancelAtPeriodEnd: false,
  };
  if (details.customerId) set.stripeCustomerId = details.customerId;
  if (details.subscriptionId) set.stripeSubscriptionId = details.subscriptionId;

  await User.updateOne({ _id: vendorId }, { $set: set });
}

// Back to the free plan. Approved items beyond the free limit are paused,
// newest items stay live. Pending items are left alone, so a paused item
// can never be resumed without an admin review.
export async function revokePremium(vendorId: string) {
  await User.updateOne(
    { _id: vendorId },
    {
      $set: { subscriptionPlan: "free", stripeCancelAtPeriodEnd: false },
      $unset: { subscriptionExpiresAt: "" },
    }
  );

  const active = await MenuItem.find({
    vendorId,
    status: { $in: ACTIVE_MENU_STATUSES },
  })
    .sort({ createdAt: -1, _id: -1 })
    .select("_id")
    .lean();

  const extra = active.slice(FREE_PLAN_ITEM_LIMIT).map((item) => item._id);
  if (extra.length > 0) {
    await MenuItem.updateMany({ _id: { $in: extra }, status: "approved" }, { status: "inactive" });
  }
}

export async function findVendorIdBySubscription(subscriptionId: string) {
  const vendor = await User.findOne({ stripeSubscriptionId: subscriptionId }).select("_id").lean();
  return vendor ? String(vendor._id) : null;
}

type TransactionInput = {
  key: string;
  vendorId: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  subscriptionId?: string | null;
  invoiceId?: string | null;
};

// Safe to call many times for the same key: the webhook and a retry never
// create two records for one payment.
export async function recordTransaction(input: TransactionInput) {
  const existing = await Transaction.findOne({ stripeSessionId: input.key });

  if (existing) {
    // A paid record is final. Anything else may move forward.
    if (existing.status !== "paid" && existing.status !== input.status) {
      existing.status = input.status;
      await existing.save();
    }
    return;
  }

  try {
    await Transaction.create({
      vendorId: input.vendorId,
      plan: "premium",
      amount: input.amount,
      currency: input.currency,
      stripeSessionId: input.key,
      stripeSubscriptionId: input.subscriptionId ?? undefined,
      stripeInvoiceId: input.invoiceId ?? undefined,
      status: input.status,
    });
  } catch (error) {
    // Two deliveries at the same moment: the unique key stops the second one.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
}
