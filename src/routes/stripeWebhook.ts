import type { Request, Response } from "express";
import type Stripe from "stripe";
import { env } from "../config/env";
import { User } from "../models/User";
import { getStripe } from "../services/stripe";
import {
  activatePremium,
  findVendorIdBySubscription,
  idOf,
  invoiceSubscriptionId,
  periodEnd,
  recordTransaction,
  revokePremium,
} from "../services/subscriptionService";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

// Only real vendors can receive a plan. Returns the id, or null for anyone else.
async function vendorIdOrNull(value: string | null | undefined): Promise<string | null> {
  if (!value || !OBJECT_ID_PATTERN.test(value)) return null;
  const user = await User.findById(value).select("role").lean();
  return user?.role === "vendor" ? value : null;
}

// The first payment: the vendor finished Checkout.
async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const vendorId = await vendorIdOrNull(
    session.client_reference_id ?? session.metadata?.vendorId
  );
  if (!vendorId) {
    console.warn("Stripe checkout completed for an unknown vendor", session.id);
    return;
  }

  const subscriptionId = idOf(session.subscription as string | { id: string } | null);
  const customerId = idOf(session.customer as string | { id: string } | null);
  const paid =
    session.payment_status === "paid" || session.payment_status === "no_payment_required";

  await recordTransaction({
    key: session.id,
    vendorId,
    amount: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    status: paid ? "paid" : "pending",
    subscriptionId,
  });

  if (!paid) return;

  const subscription = subscriptionId
    ? await getStripe().subscriptions.retrieve(subscriptionId)
    : null;

  await activatePremium(vendorId, {
    expiresAt: periodEnd(subscription),
    customerId,
    subscriptionId,
  });
}

// Later payments: every renewal extends Premium.
async function onInvoicePaid(invoice: Stripe.Invoice) {
  // The first invoice is already handled by the checkout event.
  if (invoice.billing_reason === "subscription_create") return;

  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const vendorId = await vendorIdOrNull(
    subscription.metadata?.vendorId ?? (await findVendorIdBySubscription(subscriptionId))
  );
  if (!vendorId) return;

  await recordTransaction({
    key: `invoice_${invoice.id}`,
    vendorId,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: "paid",
    subscriptionId,
    invoiceId: invoice.id,
  });

  await activatePremium(vendorId, {
    expiresAt: periodEnd(subscription),
    customerId: idOf(invoice.customer as string | { id: string } | null),
    subscriptionId,
  });
}

// A renewal payment failed. Stripe retries on its own, so access is kept for
// now and the failure is only recorded. The deleted event ends Premium.
async function onInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const vendorId = await vendorIdOrNull(await findVendorIdBySubscription(subscriptionId));
  if (!vendorId) return;

  await recordTransaction({
    key: `invoice_${invoice.id}`,
    vendorId,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: "failed",
    subscriptionId,
    invoiceId: invoice.id,
  });
}

// The subscription ended (cancelled or unpaid): take Premium away.
async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  const vendorId = await vendorIdOrNull(
    subscription.metadata?.vendorId ?? (await findVendorIdBySubscription(subscription.id))
  );
  if (!vendorId) return;

  await revokePremium(vendorId);
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "invoice.payment_succeeded":
      return onInvoicePaid(event.data.object as Stripe.Invoice);
    case "invoice.payment_failed":
      return onInvoiceFailed(event.data.object as Stripe.Invoice);
    case "customer.subscription.deleted":
      return onSubscriptionDeleted(event.data.object as Stripe.Subscription);
    default:
      // Other events are not needed. Answer 200 so Stripe stops retrying them.
      return;
  }
}

// Needs the raw request body, so it is mounted before express.json().
export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!env.stripe.secretKey || !env.stripe.webhookSecret) {
    res.status(500).json({ success: false, message: "Stripe webhook is not configured" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ success: false, message: "Missing Stripe signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, env.stripe.webhookSecret);
  } catch {
    // Not from Stripe, or the body was changed on the way.
    res.status(400).json({ success: false, message: "Invalid Stripe signature" });
    return;
  }

  try {
    await handleEvent(event);
    res.status(200).json({ received: true });
  } catch (error) {
    // A 500 makes Stripe retry later. Handlers are idempotent, so retries are safe.
    console.error("Stripe webhook failed:", event.type, error);
    res.status(500).json({ success: false, message: "Webhook handler failed" });
  }
}
