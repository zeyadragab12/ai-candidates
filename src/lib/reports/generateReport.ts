import type { SupabaseClient } from "@supabase/supabase-js";

import {
  describeDateRange,
  resolveDateWindow,
  type DateRangeSelection,
} from "@/lib/dates/dateRange";
import { fetchSourcingFilesForOwners } from "@/lib/manager/getTeamDashboardData";
import { loadUserStats } from "@/lib/performance/userStats";
import {
  buildActivityReport,
  buildPerformanceReport,
  buildPipelineReport,
  buildQualityReport,
  type ActivitySummaryRow,
} from "@/lib/reports/builders";
import type { ReportScope } from "@/lib/reports/scope";
import type { Report, ReportType } from "@/lib/reports/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export class ReportLoadError extends Error {}

/**
 * Loads just the data one report type needs and builds it. Everything is
 * aggregated in Postgres; only per-member / per-file summary rows come back.
 * Every query runs as the caller, so RLS bounds the data even beyond the
 * scope's member list.
 */
export async function generateReport(
  supabase: AnySupabaseClient,
  type: ReportType,
  scope: ReportScope,
  selection: DateRangeSelection,
): Promise<Report> {
  const window = resolveDateWindow(selection);
  const meta = {
    scopeLabel: scope.label,
    rangeLabel: describeDateRange(selection),
    generatedAt: new Date().toISOString(),
  };

  const userStats = await loadUserStats(supabase, window);
  if (userStats.error) throw new ReportLoadError("Failed to load report statistics.");

  switch (type) {
    case "performance":
      return buildPerformanceReport(scope.members, userStats.stats, meta);

    case "pipeline":
      return buildPipelineReport(scope.members, userStats.stats, meta);

    case "activity": {
      const { data, error } = await supabase.rpc("activity_summary", {
        p_from: window.from,
        p_to: window.to,
      });
      if (error) throw new ReportLoadError("Failed to load activity.");
      return buildActivityReport(
        scope.members,
        userStats.stats,
        (data ?? []) as ActivitySummaryRow[],
        meta,
      );
    }

    case "quality": {
      const files = await fetchSourcingFilesForOwners(
        supabase,
        scope.members.map((member) => member.id),
        window,
      );
      if (files.error) throw new ReportLoadError("Failed to load sourcing files.");
      return buildQualityReport(scope.members, userStats.stats, files.rows, meta);
    }
  }
}
