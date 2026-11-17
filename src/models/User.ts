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
    createdAt: Date,
  },
  { collection: "user", strict: false }
);

export const User = model("User", userSchema);
