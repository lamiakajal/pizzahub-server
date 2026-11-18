import { Router } from "express";
import {
  MENU_CATEGORIES,
  MENU_ITEM_STATUSES,
  type MenuCategory,
  type MenuItemStatus,
} from "../constants/menu";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { MenuItem } from "../models/MenuItem";
import { SORTS, listWithVendor } from "../services/menuItemService";
import { ApiError } from "../utils/ApiError";
import { buildMeta, escapeRegex, parsePagination, queryString } from "../utils/query";
import { sendSuccess } from "../utils/respond";
import { requireObjectId } from "../utils/validators";

const router = Router();

// Everything here is for admins only.
router.use(authenticate, requireRole("admin"));

// All submitted items. Query: search, status, category, page, limit
router.get("/", async (req, res) => {
  const status = queryString(req.query.status);
  const category = queryString(req.query.category);
  const search = queryString(req.query.search);

  if (status && !MENU_ITEM_STATUSES.includes(status as MenuItemStatus)) {
    throw new ApiError(400, "Invalid status");
  }
  if (category && !MENU_CATEGORIES.includes(category as MenuCategory)) {
    throw new ApiError(400, "Invalid category");
  }

  const match: Record<string, unknown> = {};
  if (status) match.status = status;
  if (category) match.category = category;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    match.$or = [{ itemName: pattern }, { location: pattern }];
  }

  const { page, limit } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
  const { items, total } = await listWithVendor({
    match,
    sort: SORTS.newest as Record<string, 1 | -1>,
    page,
    limit,
  });

  sendSuccess(res, items, { meta: buildMeta(page, limit, total) });
});

// Approve, reject, pause or move an item back to pending.
router.patch("/:id/status", async (req, res) => {
  const id = requireObjectId(req.params.id, "menu item id");
  const status = req.body?.status;

  if (!MENU_ITEM_STATUSES.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const item = await MenuItem.findByIdAndUpdate(id, { status }, { new: true });
  if (!item) throw new ApiError(404, "Menu item not found");

  sendSuccess(res, item, { message: `Menu item marked as ${status}` });
});

router.delete("/:id", async (req, res) => {
  const id = requireObjectId(req.params.id, "menu item id");
  const item = await MenuItem.findByIdAndDelete(id);
  if (!item) throw new ApiError(404, "Menu item not found");

  sendSuccess(res, { id }, { message: "Menu item deleted" });
});

export default router;
