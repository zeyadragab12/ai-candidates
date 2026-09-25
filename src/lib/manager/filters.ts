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

export const RUN_STATUSES = ["pending", "running", "complete", "error"] as const;

export interface SourcingFileFilters {
  memberId: string | null;
  status: (typeof RUN_STATUSES)[number] | null;
  jobTitle: string | null;
  range: DateRange;
  from: string | null;
  to: string | null;
  minMatch: number | null;
  minCandidates: number | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function single(params: SearchParams, key: string): string | null {
  const value = params[key];
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export function parseUuid(value: string | null): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

function parseBoundedInt(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : null;
}

/** Invalid or unknown values are dropped rather than rejected, so a hand-edited URL just falls back to "no filter". */
export function parseSourcingFileFilters(params: SearchParams): SourcingFileFilters {
  const status = single(params, "status");
  const rawFrom = single(params, "from");
  const rawTo = single(params, "to");
  const from = rawFrom && DATE_PATTERN.test(rawFrom) ? rawFrom : null;
  const to = rawTo && DATE_PATTERN.test(rawTo) ? rawTo : null;
  const requestedRange = single(params, "range");
  const range = DATE_RANGES.find((value) => value === requestedRange) ?? "all";

  return {
    memberId: parseUuid(single(params, "member")),
    status: RUN_STATUSES.find((value) => value === status) ?? null,
    jobTitle: single(params, "title")?.slice(0, 120) ?? null,
    // Filling in dates without picking "Custom range" still means custom.
    range: range === "all" && (from || to) ? "custom" : range,
    from,
    to,
    minMatch: parseBoundedInt(single(params, "minMatch"), 0, 100),
    minCandidates: parseBoundedInt(single(params, "minCandidates"), 0, 100000),
  };
}

export function hasActiveFilters(filters: SourcingFileFilters): boolean {
  return (
    filters.memberId !== null ||
    filters.status !== null ||
    filters.jobTitle !== null ||
    filters.range !== "all" ||
    filters.minMatch !== null ||
    filters.minCandidates !== null
  );
}

/** Resolves the date-range filter to a half-open [from, to) window. */
export function resolveDateWindow(
  filters: SourcingFileFilters,
  now: Date = new Date(),
): { from: string | null; to: string | null } {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const daysAgo = (days: number) => {
    const date = new Date(startOfToday);
    date.setDate(date.getDate() - (days - 1));
    return date.toISOString();
  };

  switch (filters.range) {
    case "today":
      return { from: startOfToday.toISOString(), to: null };
    case "7d":
      return { from: daysAgo(7), to: null };
    case "30d":
      return { from: daysAgo(30), to: null };
    case "90d":
      return { from: daysAgo(90), to: null };
    case "custom": {
      const to = filters.to ? new Date(`${filters.to}T00:00:00`) : null;
      if (to) to.setDate(to.getDate() + 1);
      return {
        from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : null,
        to: to ? to.toISOString() : null,
      };
    }
    default:
      return { from: null, to: null };
  }
}
