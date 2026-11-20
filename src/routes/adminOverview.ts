import { Router } from "express";
import { ROLES } from "../constants/roles";
import { MENU_ITEM_STATUSES } from "../constants/menu";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { MenuItem } from "../models/MenuItem";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { sendSuccess } from "../utils/respond";

const router = Router();

router.use(authenticate, requireRole("admin"));

const MONTHS_SHOWN = 6;

// "2026-11" style labels for the last N months, oldest first (UTC).
function recentMonths(count: number) {
  const now = new Date();
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    labels.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return labels;
}

router.get("/", async (_req, res) => {
  const months = recentMonths(MONTHS_SHOWN);
  const [firstYear, firstMonth] = months[0].split("-").map(Number);
  const since = new Date(Date.UTC(firstYear, firstMonth - 1, 1));

  const [roleGroups, statusGroups, monthGroups, transactions] = await Promise.all([
    User.aggregate<{ _id: string | null; count: number }>([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    MenuItem.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Transaction.aggregate<{ _id: string; count: number; revenue: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
          // Only paid transactions count as revenue.
          revenue: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } },
        },
      },
    ]),
    Transaction.countDocuments(),
  ]);

  // Accounts without a role were created before roles existed: they are customers.
  const roleCounts = new Map<string, number>();
  for (const group of roleGroups) {
    const role = group._id ?? "customer";
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + group.count);
  }
  const statusCounts = new Map<string, number>();
  for (const group of statusGroups) statusCounts.set(group._id, group.count);
  const monthCounts = new Map<string, { count: number; revenue: number }>();
  for (const group of monthGroups) monthCounts.set(group._id, group);

  const usersByRole = ROLES.map((role) => ({ role, count: roleCounts.get(role) ?? 0 }));
  const menuItemsByStatus = MENU_ITEM_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));
  const transactionsByMonth = months.map((month) => ({
    month,
    count: monthCounts.get(month)?.count ?? 0,
    revenue: monthCounts.get(month)?.revenue ?? 0,
  }));

  const countOf = (role: string) => roleCounts.get(role) ?? 0;

  sendSuccess(res, {
    totals: {
      users: usersByRole.reduce((sum, entry) => sum + entry.count, 0),
      vendors: countOf("vendor"),
      customers: countOf("customer"),
      menuItems: menuItemsByStatus.reduce((sum, entry) => sum + entry.count, 0),
      pendingMenuItems: statusCounts.get("pending") ?? 0,
      transactions,
    },
    usersByRole,
    menuItemsByStatus,
    transactionsByMonth,
  });
});

export default router;
