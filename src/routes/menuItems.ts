import { Router } from "express";
import { Types } from "mongoose";
import { MENU_CATEGORIES, type MenuCategory } from "../constants/menu";
import { MenuItem } from "../models/MenuItem";
import {
  SORTS,
  findOneWithVendor,
  listWithVendor,
  type SortKey,
} from "../services/menuItemService";
import { ApiError } from "../utils/ApiError";
import {
  buildMeta,
  escapeRegex,
  parsePagination,
  queryNumber,
  queryString,
} from "../utils/query";
import { sendSuccess } from "../utils/respond";
import { requireObjectId } from "../utils/validators";

const router = Router();

// Public routes. Only approved items are ever returned.

// Options for the filter dropdowns.
router.get("/filters", async (_req, res) => {
  const locations = (await MenuItem.distinct("location", { status: "approved" })) as string[];
  sendSuccess(res, {
    categories: MENU_CATEGORIES,
    locations: locations.sort((a, b) => a.localeCompare(b)),
  });
});

// Search, filter, sort and paginate.
// Query: search, category, location, minPrice, maxPrice, sort, page, limit
router.get("/", async (req, res) => {
  const search = queryString(req.query.search);
  const category = queryString(req.query.category);
  const location = queryString(req.query.location);
  const minPrice = queryNumber(req.query.minPrice);
  const maxPrice = queryNumber(req.query.maxPrice);
  const sortKey = (queryString(req.query.sort) ?? "newest") as SortKey;

  if (category && !MENU_CATEGORIES.includes(category as MenuCategory)) {
    throw new ApiError(400, "Invalid category");
  }
  if (!(sortKey in SORTS)) {
    throw new ApiError(400, "Invalid sort option");
  }

  const match: Record<string, unknown> = { status: "approved" };

  if (category) match.category = category;
  if (location) match.location = new RegExp(`^${escapeRegex(location)}$`, "i");

  if (minPrice !== undefined || maxPrice !== undefined) {
    match.price = {
      ...(minPrice !== undefined ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
    };
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    match.$or = [{ itemName: pattern }, { description: pattern }];
  }

  const { page, limit } = parsePagination(req.query, { defaultLimit: 9, maxLimit: 24 });
  const { items, total } = await listWithVendor({
    match,
    sort: SORTS[sortKey] as Record<string, 1 | -1>,
    page,
    limit,
    hideBlockedVendors: true,
  });

  sendSuccess(res, items, { meta: buildMeta(page, limit, total) });
});

// One approved item with vendor info.
router.get("/:id", async (req, res) => {
  const id = requireObjectId(req.params.id, "menu item id");
  const item = await findOneWithVendor({ _id: new Types.ObjectId(id), status: "approved" }, true);

  if (!item) throw new ApiError(404, "Menu item not found");
  sendSuccess(res, item);
});

export default router;
