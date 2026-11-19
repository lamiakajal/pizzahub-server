import { Schema, model } from "mongoose";

export const TRANSACTION_STATUSES = [
  "pending",
  "paid",
  "failed",
  "canceled",
  "expired",
] as const;

const transactionSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: { type: String, enum: ["premium"], required: true },
    // Stored in the smallest currency unit (cents), exactly as Stripe reports it.
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true },
    // Unique key that makes webhook handling idempotent. It holds the Checkout
    // Session id, or "invoice_<id>" for renewals and failed renewals.
    stripeSessionId: { type: String, required: true, unique: true },
    stripeSubscriptionId: { type: String },
    stripeInvoiceId: { type: String },
    status: {
      type: String,
      enum: [...TRANSACTION_STATUSES],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

export const Transaction = model("Transaction", transactionSchema);
