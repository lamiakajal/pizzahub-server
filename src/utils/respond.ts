import type { Response } from "express";

// Every successful response uses the same shape:
// { success: true, message?, data, meta? }
export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; message?: string; meta?: Record<string, unknown> } = {}
) {
  res.status(options.status ?? 200).json({
    success: true,
    message: options.message,
    data,
    meta: options.meta,
  });
}
