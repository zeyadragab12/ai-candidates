export const DATE_RANGES = ["all", "today", "7d", "30d", "90d", "custom"] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: "All time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Custom range",
};

export interface DateRangeSelection {
  range: DateRange;
  /** YYYY-MM-DD, only meaningful for a custom range. */
  from: string | null;
  to: string | null;
}

export type SearchParams = Record<string, string | string[] | undefined>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function singleParam(params: SearchParams, key: string): string | null {
  const value = params[key];
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export function parseDateRange(params: SearchParams, fallback: DateRange): DateRangeSelection {
  const rawFrom = singleParam(params, "from");
  const rawTo = singleParam(params, "to");
  const from = rawFrom && DATE_PATTERN.test(rawFrom) ? rawFrom : null;
  const to = rawTo && DATE_PATTERN.test(rawTo) ? rawTo : null;
  const requested = singleParam(params, "range");
  const range = DATE_RANGES.find((value) => value === requested) ?? null;

  // Filling in dates without picking "Custom range" still means custom.
  if ((range === null || range === "all") && (from || to)) {
    return { range: "custom", from, to };
  }
  return { range: range ?? fallback, from, to };
}

/** Resolves a date-range selection to a half-open [from, to) window. */
export function resolveDateWindow(
  selection: DateRangeSelection,
  now: Date = new Date(),
): { from: string | null; to: string | null } {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const daysAgo = (days: number) => {
    const date = new Date(startOfToday);
    date.setDate(date.getDate() - (days - 1));
    return date.toISOString();
  };

  switch (selection.range) {
    case "today":
      return { from: startOfToday.toISOString(), to: null };
    case "7d":
      return { from: daysAgo(7), to: null };
    case "30d":
      return { from: daysAgo(30), to: null };
    case "90d":
      return { from: daysAgo(90), to: null };
    case "custom": {
      const to = selection.to ? new Date(`${selection.to}T00:00:00`) : null;
      if (to) to.setDate(to.getDate() + 1);
      return {
        from: selection.from ? new Date(`${selection.from}T00:00:00`).toISOString() : null,
        to: to ? to.toISOString() : null,
      };
    }
    default:
      return { from: null, to: null };
  }
}

/** Human-readable label, e.g. "Last 30 days" or "1 Sep 2026 – 10 Sep 2026". */
export function describeDateRange(selection: DateRangeSelection): string {
  if (selection.range !== "custom") return DATE_RANGE_LABELS[selection.range];
  const format = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (selection.from && selection.to) return `${format(selection.from)} – ${format(selection.to)}`;
  if (selection.from) return `Since ${format(selection.from)}`;
  if (selection.to) return `Until ${format(selection.to)}`;
  return DATE_RANGE_LABELS.all;
}
