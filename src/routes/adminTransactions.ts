import { Router } from "express";
import type { PipelineStage } from "mongoose";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { TRANSACTION_STATUSES, Transaction } from "../models/Transaction";
import { ApiError } from "../utils/ApiError";
import { buildMeta, escapeRegex, parsePagination, queryString } from "../utils/query";
import { sendSuccess } from "../utils/respond";

const router = Router();

// Admins can only read payments. There is deliberately no write route here.
router.use(authenticate, requireRole("admin"));

// Query: status, search (vendor or business name), page, limit
router.get("/", async (req, res) => {
  const status = queryString(req.query.status);
  const search = queryString(req.query.search);

  if (status && !(TRANSACTION_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });

  const pipeline: PipelineStage[] = [];
  if (status) pipeline.push({ $match: { status } });

  pipeline.push({
    $lookup: {
      from: "user",
      localField: "vendorId",
      foreignField: "_id",
      // Only name fields are kept, so the vendor email never leaves the server.
      pipeline: [{ $project: { name: 1, businessName: 1 } }],
      as: "vendor",
    },
  });
  pipeline.push({ $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } });

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    pipeline.push({ $match: { $or: [{ "vendor.name": pattern }, { "vendor.businessName": pattern }] } });
  }

  pipeline.push({
    $facet: {
      rows: [
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            plan: 1,
            amount: 1,
            currency: 1,
            status: 1,
            createdAt: 1,
            vendor: {
              id: { $toString: "$vendorId" },
              name: { $ifNull: ["$vendor.name", null] },
              businessName: { $ifNull: ["$vendor.businessName", null] },
            },
          },
        },
      ],
      count: [{ $count: "total" }],
    },
  });

  const [result] = await Transaction.aggregate(pipeline);
  const total: number = result?.count?.[0]?.total ?? 0;

  sendSuccess(res, result?.rows ?? [], { meta: buildMeta(page, limit, total) });
});

export default router;
