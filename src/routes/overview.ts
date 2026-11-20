import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { MenuItem } from "../models/MenuItem";
import { Order } from "../models/Order";
import { itemsByStatus, orderCharts } from "../services/overviewStats";
import { currentUser } from "../utils/currentUser";
import { sendSuccess } from "../utils/respond";
import { isPremiumActive } from "../utils/subscription";

export const customerOverviewRouter = Router();
customerOverviewRouter.use(authenticate, requireRole("customer"));

customerOverviewRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const count = (status?: string) => {
    // Built as a plain object so TypeScript 7 accepts the optional status.
    const filter: Record<string, unknown> = { customerId: user.id };
    if (status) filter.status = status;
    return Order.countDocuments(filter);
  };

  const [total, pending, accepted, rejected, cancelled, charts] = await Promise.all([
    count(),
    count("pending"),
    count("accepted"),
    count("rejected"),
    count("cancelled"),
    orderCharts("customerId", user.id),
  ]);

  sendSuccess(res, { total, pending, accepted, rejected, cancelled, ...charts });
});

export const vendorOverviewRouter = Router();
vendorOverviewRouter.use(authenticate, requireRole("vendor"));

vendorOverviewRouter.get("/", async (req, res) => {
  const user = currentUser(req);

  const [totalItems, activeItems, pendingOrders, acceptedOrders, charts, itemStatuses] = await Promise.all([
    MenuItem.countDocuments({ vendorId: user.id }),
    MenuItem.countDocuments({ vendorId: user.id, status: "approved" }),
    Order.countDocuments({ vendorId: user.id, status: "pending" }),
    Order.countDocuments({ vendorId: user.id, status: "accepted" }),
    orderCharts("vendorId", user.id),
    itemsByStatus(user.id),
  ]);

  sendSuccess(res, {
    totalItems,
    activeItems,
    pendingOrders,
    acceptedOrders,
    ...charts,
    itemsByStatus: itemStatuses,
    plan: isPremiumActive(user) ? "premium" : "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  });
});
