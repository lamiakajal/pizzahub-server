// Express gives query values as string, string[] or objects. These helpers
// normalize them so routes never trust raw input.

export function queryString(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string") return undefined;
  const trimmed = first.trim();
  return trimmed ? trimmed : undefined;
}

export function queryNumber(value: unknown): number | undefined {
  const text = queryString(value);
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parsePagination(
  query: Record<string, unknown>,
  options: { defaultLimit?: number; maxLimit?: number } = {}
) {
  const { defaultLimit = 9, maxLimit = 50 } = options;
  const page = Math.max(1, Math.floor(queryNumber(query.page) ?? 1));
  const limit = Math.min(
    maxLimit,
    Math.max(1, Math.floor(queryNumber(query.limit) ?? defaultLimit))
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
