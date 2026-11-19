import { Router } from "express";
import { ROLES, type Role } from "../constants/roles";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { MenuItem } from "../models/MenuItem";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { ADMIN_USER_FIELDS, toAdminUser } from "../utils/adminUser";
import { currentUser } from "../utils/currentUser";
import { buildMeta, escapeRegex, parsePagination, queryString } from "../utils/query";
import { sendSuccess } from "../utils/respond";
import { requireObjectId } from "../utils/validators";

const router = Router();

// Everything here is for admins only.
router.use(authenticate, requireRole("admin"));

// Query: search, role, blocked, page, limit
router.get("/", async (req, res) => {
  const search = queryString(req.query.search);
  const role = queryString(req.query.role);
  const blocked = queryString(req.query.blocked);

  if (role && !ROLES.includes(role as Role)) {
    throw new ApiError(400, "Invalid role");
  }
  if (blocked && blocked !== "true" && blocked !== "false") {
    throw new ApiError(400, "Blocked must be true or false");
  }

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  // Users created before the flag existed have no isBlocked field at all.
  if (blocked === "true") filter.isBlocked = true;
  if (blocked === "false") filter.isBlocked = { $ne: true };
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });

  const [users, total] = await Promise.all([
    User.find(filter, ADMIN_USER_FIELDS).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  sendSuccess(res, users.map(toAdminUser), { meta: buildMeta(page, limit, total) });
});

router.get("/:id", async (req, res) => {
  const id = requireObjectId(req.params.id, "user id");

  const user = await User.findById(id, ADMIN_USER_FIELDS).lean();
  if (!user) throw new ApiError(404, "User not found");

  const [menuItemCount, orderCount] = await Promise.all([
    user.role === "vendor" ? MenuItem.countDocuments({ vendorId: id }) : 0,
    Order.countDocuments({ $or: [{ customerId: id }, { vendorId: id }] }),
  ]);

  sendSuccess(res, { ...toAdminUser(user), menuItemCount, orderCount });
});

// Body: { blocked: boolean }
router.patch("/:id/block", async (req, res) => {
  const id = requireObjectId(req.params.id, "user id");
  const blocked = req.body?.blocked;

  if (typeof blocked !== "boolean") {
    throw new ApiError(400, "Blocked must be true or false");
  }

  const admin = currentUser(req);
  const target = await User.findById(id, { role: 1 }).lean();
  if (!target) throw new ApiError(404, "User not found");

  if (target.role === "admin" || String(target._id) === admin.id) {
    throw new ApiError(403, "Admin accounts cannot be blocked");
  }

  const updated = await User.findByIdAndUpdate(
    id,
    { isBlocked: blocked },
    { new: true, projection: ADMIN_USER_FIELDS }
  ).lean();
  if (!updated) throw new ApiError(404, "User not found");

  sendSuccess(res, toAdminUser(updated), {
    message: blocked ? "User blocked" : "User unblocked",
  });
});

export default router;
