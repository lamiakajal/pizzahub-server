import { Router } from "express";
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES, type OrderStatus } from "../constants/order";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { MenuItem } from "../models/MenuItem";
import { Order } from "../models/Order";
import { User } from "../models/User";
import {
  ORDER_POPULATE,
  parseDeliveryDate,
  serializeOrder,
  type PopulatedOrder,
} from "../services/orderService";
import { ApiError } from "../utils/ApiError";
import { currentUser } from "../utils/currentUser";
import { buildMeta, parsePagination, queryString } from "../utils/query";
import { sendSuccess } from "../utils/respond";
import { readOptionalText, readText, requireObjectId } from "../utils/validators";

const router = Router();

// Only customers place and manage their own orders here.
router.use(authenticate, requireRole("customer"));

// Place an order. The vendor always comes from the item, never from the request.
router.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = (req.body ?? {}) as Record<string, unknown>;

  const itemId = requireObjectId(body.itemId, "menu item id");
  const deliveryDate = parseDeliveryDate(body.deliveryDate);
  const deliveryAddress = readText(body.deliveryAddress, "Delivery address", 5, 300);
  const message = readOptionalText(body.message, "Message", 500);

  // Only approved items can be ordered.
  const item = await MenuItem.findOne({ _id: itemId, status: "approved" });
  if (!item) throw new ApiError(404, "This item is not available for ordering");

  if (String(item.vendorId) === user.id) {
    throw new ApiError(403, "You cannot order your own menu item");
  }

  const vendor = await User.findById(item.vendorId).select("isBlocked").lean();
  if (!vendor || vendor.isBlocked) {
    throw new ApiError(404, "This item is not available for ordering");
  }

  const duplicate = await Order.exists({
    itemId: item._id,
    customerId: user.id,
    deliveryDate,
    status: { $in: ACTIVE_ORDER_STATUSES },
  });
  if (duplicate) {
    throw new ApiError(409, "You already have an active order for this item on that date");
  }

  try {
    const order = await Order.create({
      itemId: item._id,
      vendorId: item.vendorId,
      customerId: user.id,
      deliveryDate,
      deliveryAddress,
      message,
      status: "pending",
    });
    sendSuccess(
      res,
      { _id: order._id, status: order.status },
      { status: 201, message: "Order placed. The restaurant will review it soon." }
    );
  } catch (error) {
    // Two requests at the same moment can both pass the check above.
    // The unique index catches the second one.
    if ((error as { code?: number }).code === 11000) {
      throw new ApiError(409, "You already have an active order for this item on that date");
    }
    throw error;
  }
});

// My orders. Query: status, page, limit
router.get("/", async (req, res) => {
  const user = currentUser(req);
  const status = queryString(req.query.status);

  if (status && !ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new ApiError(400, "Invalid status");
  }

  const filter: Record<string, unknown> = { customerId: user.id };
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

// Cancel one of my own orders, but only while it is still pending.
router.patch("/:id/cancel", async (req, res) => {
  const user = currentUser(req);
  const id = requireObjectId(req.params.id, "order id");

  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, "Order not found");
  if (String(order.customerId) !== user.id) {
    throw new ApiError(403, "You can only cancel your own orders");
  }
  if (order.status !== "pending") {
    throw new ApiError(409, `Only pending orders can be cancelled. This order is already ${order.status}.`);
  }

  // The status is checked again in the update, in case the vendor answered a moment ago.
  const updated = await Order.findOneAndUpdate(
    { _id: id, customerId: user.id, status: "pending" },
    { status: "cancelled" },
    { new: true }
  );
  if (!updated) {
    throw new ApiError(409, "This order was just updated and can no longer be cancelled");
  }

  sendSuccess(res, { _id: updated._id, status: updated.status }, { message: "Order cancelled" });
});

export default router;
