import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { MenuItem } from "../models/MenuItem";
import { Order } from "../models/Order";
import { currentUser } from "../utils/currentUser";
import { sendSuccess } from "../utils/respond";
import { isPremiumActive } from "../utils/subscription";

export const customerOverviewRouter = Router();
customerOverviewRouter.use(authenticate, requireRole("customer"));

customerOverviewRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const count = (status?: string) =>
    Order.countDocuments({ customerId: user.id, ...(status ? { status } : {}) });

  const [total, pending, accepted, rejected, cancelled] = await Promise.all([
    count(),
    count("pending"),
    count("accepted"),
    count("rejected"),
    count("cancelled"),
  ]);

  sendSuccess(res, { total, pending, accepted, rejected, cancelled });
});

export const vendorOverviewRouter = Router();
vendorOverviewRouter.use(authenticate, requireRole("vendor"));

vendorOverviewRouter.get("/", async (req, res) => {
  const user = currentUser(req);

  const [totalItems, activeItems, pendingOrders, acceptedOrders] = await Promise.all([
    MenuItem.countDocuments({ vendorId: user.id }),
    MenuItem.countDocuments({ vendorId: user.id, status: "approved" }),
    Order.countDocuments({ vendorId: user.id, status: "pending" }),
    Order.countDocuments({ vendorId: user.id, status: "accepted" }),
  ]);

  sendSuccess(res, {
    totalItems,
    activeItems,
    pendingOrders,
    acceptedOrders,
    plan: isPremiumActive(user) ? "premium" : "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  });
});
