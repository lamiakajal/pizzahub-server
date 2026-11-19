import { Router } from "express";
import { FREE_PLAN_ITEM_LIMIT } from "../constants/menu";
import { env } from "../config/env";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { User } from "../models/User";
import { getPremiumPriceId, getStripe } from "../services/stripe";
import { ApiError } from "../utils/ApiError";
import { currentUser } from "../utils/currentUser";
import { sendSuccess } from "../utils/respond";
import { isPremiumActive } from "../utils/subscription";

const router = Router();

// Only vendors manage a subscription, and only their own.
router.use(authenticate, requireRole("vendor"));

// Current plan, plus the Premium price for display.
router.get("/", async (req, res) => {
  const user = currentUser(req);
  const premium = isPremiumActive(user);
  const record = await User.findById(user.id).select("stripeCancelAtPeriodEnd").lean();

  let price: { amount: number | null; currency: string; interval: string | null } | null = null;
  if (env.stripe.secretKey && env.stripe.premiumPriceId) {
    try {
      const found = await getStripe().prices.retrieve(env.stripe.premiumPriceId);
      price = {
        amount: found.unit_amount,
        currency: found.currency,
        interval: found.recurring?.interval ?? null,
      };
    } catch {
      // The page still works without a price.
    }
  }

  sendSuccess(res, {
    plan: premium ? "premium" : "free",
    premium,
    expiresAt: premium ? user.subscriptionExpiresAt : null,
    cancelAtPeriodEnd: premium && Boolean(record?.stripeCancelAtPeriodEnd),
    freeItemLimit: FREE_PLAN_ITEM_LIMIT,
    price,
  });
});

// Start Stripe Checkout. The vendor always comes from the verified token,
// never from the request, so nobody can start a session for someone else.
router.post("/checkout", async (req, res) => {
  const user = currentUser(req);

  if (isPremiumActive(user)) {
    throw new ApiError(409, "You already have an active Premium plan");
  }

  const stripe = getStripe();
  const priceId = getPremiumPriceId();
  const record = await User.findById(user.id).select("stripeCustomerId").lean();
  const metadata = { vendorId: user.id, plan: "premium" };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.clientUrl}/payment/cancel`,
    client_reference_id: user.id,
    metadata,
    subscription_data: { metadata },
    // Reuse the Stripe customer of returning vendors.
    ...(record?.stripeCustomerId
      ? { customer: record.stripeCustomerId }
      : { customer_email: user.email }),
  });

  if (!session.url) throw new ApiError(502, "Could not start checkout. Please try again.");
  sendSuccess(res, { url: session.url });
});

// Cancel at the end of the paid period. Premium stays until then, and the
// webhook removes it when Stripe closes the subscription.
router.post("/cancel", async (req, res) => {
  const user = currentUser(req);
  const record = await User.findById(user.id).select("stripeSubscriptionId").lean();

  if (!isPremiumActive(user) || !record?.stripeSubscriptionId) {
    throw new ApiError(409, "There is no active subscription to cancel");
  }

  await getStripe().subscriptions.update(record.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  await User.updateOne({ _id: user.id }, { $set: { stripeCancelAtPeriodEnd: true } });

  sendSuccess(
    res,
    { cancelAtPeriodEnd: true },
    { message: "Premium will end when the current billing period finishes" }
  );
});

export default router;
