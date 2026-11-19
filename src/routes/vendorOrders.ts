import { Router } from "express";
import { ORDER_STATUSES, type OrderStatus } from "../constants/order";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { Order } from "../models/Order";
import {
  ORDER_POPULATE,
  serializeOrder,
  type PopulatedOrder,
} from "../services/orderService";
import { ApiError } from "../utils/ApiError";
import { currentUser } from "../utils/currentUser";
import { buildMeta, parsePagination, queryString } from "../utils/query";
import { sendSuccess } from "../utils/respond";
import { requireObjectId } from "../utils/validators";

const router = Router();

// Vendors only see and answer orders for their own menu items.
router.use(authenticate, requireRole("vendor"));

// Incoming orders. Query: status, page, limit
router.get("/", async (req, res) => {
  const user = currentUser(req);
  const status = queryString(req.query.status);

  if (status && !ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new ApiError(400, "Invalid status");
  }

  const filter: Record<string, unknown> = { vendorId: user.id };
  if (status) filter.status = status;

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 8, maxLimit: 30 });
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate(ORDER_POPULATE)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  sendSuccess(res, (orders as unknown as PopulatedOrder[]).map(serializeOrder), {
    meta: buildMeta(page, limit, total),
  });
});

// Accept or reject an order. Only a pending order can be answered, and only once.
router.patch("/:id/status", async (req, res) => {
  const user = currentUser(req);
  const id = requireObjectId(req.params.id, "order id");
  const status = req.body?.status;

  if (status !== "accepted" && status !== "rejected") {
    throw new ApiError(400, "Status must be accepted or rejected");
  }

  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, "Order not found");
  if (String(order.vendorId) !== user.id) {
    throw new ApiError(403, "You can only manage orders for your own menu items");
  }
  if (order.status !== "pending") {
    throw new ApiError(409, `This order is already ${order.status} and cannot be changed`);
  }

  // The pending check is repeated in the update, so a double click or a
  // simultaneous cancel by the customer can never flip an answered order.
  const updated = await Order.findOneAndUpdate(
    { _id: id, vendorId: user.id, status: "pending" },
    { status },
    { new: true }
  );
  if (!updated) {
    throw new ApiError(409, "This order was just updated and cannot be changed");
  }

  sendSuccess(
    res,
    { _id: updated._id, status: updated.status },
    { message: `Order ${status}` }
  );
});

export default router;
