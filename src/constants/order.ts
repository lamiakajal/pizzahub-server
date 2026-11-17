export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Statuses that still count as an open order for duplicate checks.
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["pending", "accepted"];
