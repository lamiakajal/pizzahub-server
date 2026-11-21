import type { PopulateOptions } from "mongoose";
import { ApiError } from "../utils/ApiError";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Delivery dates arrive as "YYYY-MM-DD" and are stored as the start of that day (UTC).
// That is what makes the duplicate order check work for the same calendar day.
export function parseDeliveryDate(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, "Choose a valid delivery date");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "Choose a valid delivery date");
  }

  const today = startOfDayUtc(new Date());
  // One day of slack, so people in far-west time zones can still pick their own "today".
  if (date.getTime() < today.getTime() - DAY_MS) {
    throw new ApiError(400, "Delivery date cannot be in the past");
  }
  if (date.getTime() > today.getTime() + 365 * DAY_MS) {
    throw new ApiError(400, "Delivery date is too far ahead");
  }
  return date;
}

export const ORDER_POPULATE: PopulateOptions[] = [
  { path: "itemId", select: "itemName images price category" },
  { path: "vendorId", select: "name image businessName" },
  { path: "customerId", select: "name email image" },
];

export type PopulatedOrder = {
  _id: unknown;
  status: string;
  deliveryDate: Date;
  deliveryAddress: string;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  itemId: unknown;
  vendorId: unknown;
  customerId: unknown;
};

// A populated reference becomes an object; a deleted one becomes null.
function pick(value: unknown, fields: string[]) {
  if (!value || typeof value !== "object" || !("_id" in value)) return null;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = { _id: source._id };
  for (const field of fields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
}

export function serializeOrder(order: PopulatedOrder) {
  return {
    _id: order._id,
    status: order.status,
    deliveryDate: order.deliveryDate,
    deliveryAddress: order.deliveryAddress,
    message: order.message ?? "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    item: pick(order.itemId, ["itemName", "images", "price", "category"]),
    vendor: pick(order.vendorId, ["name", "image", "businessName"]),
    customer: pick(order.customerId, ["name", "email", "image"]),
  };
}
