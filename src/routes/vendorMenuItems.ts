import { Router, type Request } from "express";
import { MENU_ITEM_STATUSES, FREE_PLAN_ITEM_LIMIT, type MenuItemStatus } from "../constants/menu";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { MenuItem } from "../models/MenuItem";
import { assertCanHaveActiveItem, countActiveItems } from "../services/menuItemService";
import { ApiError } from "../utils/ApiError";
import { currentUser } from "../utils/currentUser";
import { buildMeta, escapeRegex, parsePagination, queryString } from "../utils/query";
import { sendSuccess } from "../utils/respond";
import { isPremiumActive } from "../utils/subscription";
import { parseMenuItemInput, requireObjectId } from "../utils/validators";

const router = Router();

// Everything here is for signed-in vendors only.
router.use(authenticate, requireRole("vendor"));

function vendorOf(req: Request) {
  return currentUser(req);
}

// Loads an item and makes sure it belongs to the signed-in vendor.
async function findOwnedItem(req: Request) {
  const user = vendorOf(req);
  const id = requireObjectId(req.params.id, "menu item id");
  const item = await MenuItem.findById(id);

  if (!item) throw new ApiError(404, "Menu item not found");
  if (String(item.vendorId) !== user.id) {
    throw new ApiError(403, "You can only manage your own menu items");
  }
  return item;
}

// List my items. Query: status, search, page, limit
router.get("/", async (req, res) => {
  const user = vendorOf(req);
  const status = queryString(req.query.status);
  const search = queryString(req.query.search);

  if (status && !MENU_ITEM_STATUSES.includes(status as MenuItemStatus)) {
    throw new ApiError(400, "Invalid status");
  }

  const filter: Record<string, unknown> = { vendorId: user.id };
  if (status) filter.status = status;
  if (search) filter.itemName = new RegExp(escapeRegex(search), "i");

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 8, maxLimit: 30 });
  const [items, total, activeCount] = await Promise.all([
    MenuItem.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    MenuItem.countDocuments(filter),
    countActiveItems(user.id),
  ]);

  sendSuccess(res, items, {
    meta: {
      ...buildMeta(page, limit, total),
      activeCount,
      // null means unlimited (Premium).
      activeLimit: isPremiumActive(user) ? null : FREE_PLAN_ITEM_LIMIT,
    },
  });
});

// Create. New items start as "pending" until an admin approves them.
router.post("/", async (req, res) => {
  const user = vendorOf(req);
  const input = parseMenuItemInput(req.body);

  await assertCanHaveActiveItem(user);

  const item = await MenuItem.create({ ...input, vendorId: user.id, status: "pending" });
  sendSuccess(res, item, {
    status: 201,
    message: "Menu item submitted for approval",
  });
});

router.get("/:id", async (req, res) => {
  const item = await findOwnedItem(req);
  sendSuccess(res, item);
});

// Update. A rejected item goes back to "pending" when the vendor resubmits it.
router.patch("/:id", async (req, res) => {
  const user = vendorOf(req);
  const item = await findOwnedItem(req);
  const input = parseMenuItemInput(req.body, true);

  if (Object.keys(input).length === 0) {
    throw new ApiError(400, "Nothing to update");
  }

  if (item.status === "rejected") {
    await assertCanHaveActiveItem(user, String(item._id));
    item.status = "pending";
  }

  item.set(input);
  await item.save();
  sendSuccess(res, item, { message: "Menu item updated" });
});

// Availability: pause an approved item, or resume a paused one.
router.patch("/:id/availability", async (req, res) => {
  const user = vendorOf(req);
  const item = await findOwnedItem(req);
  const available = req.body?.available;

  if (typeof available !== "boolean") {
    throw new ApiError(400, "available must be true or false");
  }
  if (item.status !== "approved" && item.status !== "inactive") {
    throw new ApiError(409, "Only approved items can be paused or resumed");
  }

  if (available && item.status === "inactive") {
    await assertCanHaveActiveItem(user, String(item._id));
    item.status = "approved";
  } else if (!available && item.status === "approved") {
    item.status = "inactive";
  }

  await item.save();
  sendSuccess(res, item, {
    message: available ? "Menu item is available again" : "Menu item paused",
  });
});

router.delete("/:id", async (req, res) => {
  const item = await findOwnedItem(req);
  await item.deleteOne();
  sendSuccess(res, { id: String(item._id) }, { message: "Menu item deleted" });
});

export default router;
