import { Types } from "mongoose";
import { MENU_ITEM_STATUSES } from "../constants/menu";
import { ORDER_STATUSES } from "../constants/order";
import { MenuItem } from "../models/MenuItem";
import { Order } from "../models/Order";
import { monthsStart, recentMonths } from "../utils/months";

const MONTHS_SHOWN = 6;

type Group = { _id: string; count: number };

// Aggregation does not cast ids like find does, so the id is converted here.
function ownerFilter(field: "customerId" | "vendorId", userId: string) {
  const filter: Record<string, unknown> = {};
  filter[field] = new Types.ObjectId(userId);
  return filter;
}

function fillStatuses<T extends string>(statuses: readonly T[], groups: Group[]) {
  const counts = new Map<string, number>();
  for (const group of groups) counts.set(group._id, group.count);
  return statuses.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

// Orders per status and per month (last 6 months, empty months included as 0).
export async function orderCharts(field: "customerId" | "vendorId", userId: string) {
  const months = recentMonths(MONTHS_SHOWN);
  const owner = ownerFilter(field, userId);

  const monthMatch: Record<string, unknown> = { ...owner, createdAt: { $gte: monthsStart(months) } };

  const [statusGroups, monthGroups] = await Promise.all([
    Order.aggregate<Group>([
      { $match: owner },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Order.aggregate<Group>([
      { $match: monthMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const monthCounts = new Map<string, number>();
  for (const group of monthGroups) monthCounts.set(group._id, group.count);

  return {
    ordersByStatus: fillStatuses(ORDER_STATUSES, statusGroups),
    ordersByMonth: months.map((month) => ({ month, count: monthCounts.get(month) ?? 0 })),
  };
}

export async function itemsByStatus(vendorId: string) {
  const groups = await MenuItem.aggregate<Group>([
    { $match: ownerFilter("vendorId", vendorId) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  return fillStatuses(MENU_ITEM_STATUSES, groups);
}
