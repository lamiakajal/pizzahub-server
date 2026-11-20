// "2026-11" style labels for the last N months, oldest first (UTC).
export function recentMonths(count: number) {
  const now = new Date();
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    labels.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return labels;
}

// First moment of the oldest month in a list made by recentMonths.
export function monthsStart(months: string[]) {
  const [year, month] = months[0].split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}
