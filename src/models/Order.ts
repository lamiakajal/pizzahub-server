import { Schema, model } from "mongoose";
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES } from "../constants/order";

const orderSchema = new Schema(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Routes normalize this to the start of the delivery day (UTC).
    deliveryDate: { type: Date, required: true },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 300 },
    message: { type: String, trim: true, maxlength: 500, default: "" },
    status: {
      type: String,
      enum: [...ORDER_STATUSES],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// A customer cannot hold two open orders for the same item and delivery date.
orderSchema.index(
  { itemId: 1, customerId: 1, deliveryDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_ORDER_STATUSES } },
  }
);

export const Order = model("Order", orderSchema);
