import type { PipelineStage } from "mongoose";
import { ACTIVE_MENU_STATUSES, FREE_PLAN_ITEM_LIMIT } from "../constants/menu";
import { MenuItem } from "../models/MenuItem";
import type { AuthUser } from "../types/auth";
import { ApiError } from "../utils/ApiError";
import { isPremiumActive } from "../utils/subscription";

export const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
  // Premium vendors first, then newest.
  featured: { isPremium: -1, createdAt: -1, _id: -1 },
} as const;

export type SortKey = keyof typeof SORTS;

// Only these vendor fields are ever sent to the browser.
const PROJECTION = {
  itemName: 1,
  category: 1,
  description: 1,
  price: 1,
  location: 1,
  images: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
  vendorId: 1,
  isPremium: 1,
  vendor: {
    id: "$vendor._id",
    name: "$vendor.name",
    image: "$vendor.image",
    businessName: "$vendor.businessName",
  },
};

function withVendor(match: Record<string, unknown>, hideBlockedVendors: boolean) {
  const stages: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: "user",
        localField: "vendorId",
        foreignField: "_id",
        as: "vendor",
      },
    },
    { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
  ];

  if (hideBlockedVendors) {
    stages.push({ $match: { "vendor.isBlocked": { $ne: true } } });
  }

  stages.push({
    $addFields: {
      isPremium: {
        $and: [
          { $eq: ["$vendor.subscriptionPlan", "premium"] },
          {
            $or: [
              { $eq: [{ $ifNull: ["$vendor.subscriptionExpiresAt", null] }, null] },
              { $gt: ["$vendor.subscriptionExpiresAt", "$$NOW"] },
            ],
          },
        ],
      },
    },
  });

  return stages;
}

type ListOptions = {
  match: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
  page: number;
  limit: number;
  // Public lists hide items from blocked vendors.
  hideBlockedVendors?: boolean;
};

export async function listWithVendor(options: ListOptions) {
  const { match, sort, page, limit, hideBlockedVendors = false } = options;

  const pipeline: PipelineStage[] = [
    ...withVendor(match, hideBlockedVendors),
    { $sort: sort },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: PROJECTION },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await MenuItem.aggregate(pipeline);
  return {
    items: (result?.items ?? []) as Record<string, unknown>[],
    total: (result?.total?.[0]?.count ?? 0) as number,
  };
}

export async function findOneWithVendor(
  match: Record<string, unknown>,
  hideBlockedVendors = false
) {
  const [item] = await MenuItem.aggregate([
    ...withVendor(match, hideBlockedVendors),
    { $limit: 1 },
    { $project: PROJECTION },
  ]);
  return (item ?? null) as Record<string, unknown> | null;
}

export function countActiveItems(vendorId: string, excludeId?: string) {
  return MenuItem.countDocuments({
    vendorId,
    status: { $in: ACTIVE_MENU_STATUSES },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
}

// Free vendors may keep at most FREE_PLAN_ITEM_LIMIT active items.
export async function assertCanHaveActiveItem(user: AuthUser, excludeId?: string) {
  if (isPremiumActive(user)) return;

  const active = await countActiveItems(user.id, excludeId);
  if (active >= FREE_PLAN_ITEM_LIMIT) {
    throw new ApiError(
      403,
      `Free plan allows up to ${FREE_PLAN_ITEM_LIMIT} active menu items. Upgrade to Premium to add more.`
    );
  }
}
