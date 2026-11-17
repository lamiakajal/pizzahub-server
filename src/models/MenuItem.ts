import { Schema, model } from "mongoose";
import { MENU_CATEGORIES, MENU_ITEM_STATUSES } from "../constants/menu";

const menuItemSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    category: {
      type: String,
      enum: [...MENU_CATEGORIES],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true, trim: true, index: true },
    images: {
      type: [String],
      validate: {
        validator: (value: string[]) => value.length > 0,
        message: "At least one image is required",
      },
    },
    status: {
      type: String,
      enum: [...MENU_ITEM_STATUSES],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

export const MenuItem = model("MenuItem", menuItemSchema);
