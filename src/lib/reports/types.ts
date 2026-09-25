export const REPORT_TYPES = ["performance", "activity", "pipeline", "quality"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_META: Record<ReportType, { title: string; description: string }> = {
  performance: {
    title: "Team Performance",
    description: "Jobs, sourcing runs, and candidate outcomes per member.",
  },
  activity: {
    title: "Activity",
    description: "Sign-ins and recorded actions per member.",
  },
  pipeline: {
    title: "Recruitment Pipeline",
    description: "Where sourced candidates currently sit in the pipeline.",
  },
  quality: {
    title: "Sourcing Quality",
    description: "Average AI match quality by member, job, and sourcing file.",
  },
};

export type ReportCell = string | number | null;

export interface ReportColumn {
  key: string;
  label: string;
  /** Controls alignment and on-screen formatting; exports keep raw values. */
  kind?: "text" | "number" | "percent" | "match" | "date";
}

export interface ReportSection {
  id: string;
  title: string;
  description?: string;
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  totals?: Record<string, ReportCell>;
  emptyMessage: string;
}

export interface Report {
  type: ReportType;
  title: string;
  description: string;
  scopeLabel: string;
  rangeLabel: string;
  generatedAt: string;
  summary: { label: string; value: string }[];
  sections: ReportSection[];
}

export interface ReportMeta {
  scopeLabel: string;
  rangeLabel: string;
  generatedAt: string;
}

export function parseReportType(value: string | null): ReportType | null {
  return REPORT_TYPES.find((type) => type === value) ?? null;
}
