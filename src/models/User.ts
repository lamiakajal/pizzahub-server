import { Schema, model } from "mongoose";
import { ROLES, SUBSCRIPTION_PLANS } from "../constants/roles";

// Maps onto the "user" collection that Better Auth creates and owns.
// Sign up, passwords and sessions are handled there; the API reads this
// collection to check role and block status, and updates subscription fields.
const userSchema = new Schema(
  {
    name: String,
    email: String,
    image: String,
    role: { type: String, enum: [...ROLES], default: "customer" },
    isBlocked: { type: Boolean, default: false },
    businessName: String,
    subscriptionPlan: {
      type: String,
      enum: [...SUBSCRIPTION_PLANS],
      default: "free",
    },
    subscriptionExpiresAt: Date,
    // Stripe bookkeeping. Written only by the payment code on the server.
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    stripeCancelAtPeriodEnd: { type: Boolean, default: false },
    createdAt: Date,
  },
  { collection: "user", strict: false }
);

export const User = model("User", userSchema);
