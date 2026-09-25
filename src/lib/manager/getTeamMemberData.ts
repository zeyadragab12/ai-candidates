import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ACTIVITY_FEED_COLUMNS,
  toActivityFeedItems,
  type ActivityFeedItem,
  type ActivityLogRow,
} from "@/lib/activity/feed";
import { fetchSourcingFiles, type TeamSourcingFileRow } from "@/lib/manager/getTeamDashboardData";
import {
  loadUserStats,
  pipelineCountsOf,
  toUserPerformanceRow,
  type ProfileRow,
  type UserPerformanceRow,
} from "@/lib/performance/userStats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

interface AccessRow {
  search_run_id: string;
  accessed_at: string;
  search_runs: { job_id: string; jobs: { title: string } | null } | null;
}

export interface RecentlyOpenedFile {
  runId: string;
  jobId: string;
  jobTitle: string;
  accessedAt: string;
}

export interface TeamMemberData {
  member: UserPerformanceRow;
  pipelineCounts: Record<string, number>;
  files: TeamSourcingFileRow[];
  recentlyOpened: RecentlyOpenedFile[];
  recentActivity: ActivityFeedItem[];
  loadError: string | null;
}

/**
 * Returns null when the member isn't visible to the caller — RLS on
 * `profiles` only exposes a manager's own team (and everyone to an admin),
 * so an out-of-team id is indistinguishable from a nonexistent one.
 */
export async function getTeamMemberData(
  supabase: AnySupabaseClient,
  memberId: string,
): Promise<TeamMemberData | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, team_id, is_active, created_at, teams(name)")
    .eq("id", memberId)
    .maybeSingle();

  if (profileError || !profile) return null;
  const memberProfile = profile as unknown as ProfileRow & { teams: { name: string } | null };

  const [userStats, filesRes, accessRes, activityRes] = await Promise.all([
    loadUserStats(supabase),
    memberProfile.team_id
      ? fetchSourcingFiles(supabase, memberProfile.team_id, { memberId }, 50)
      : Promise.resolve({ rows: [], error: false }),
    supabase
      .from("search_run_access")
      .select("search_run_id, accessed_at, search_runs(job_id, jobs(title))")
      .eq("user_id", memberId)
      .order("accessed_at", { ascending: false })
      .limit(30),
    supabase
      .from("activity_log")
      .select(ACTIVITY_FEED_COLUMNS)
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const loadError =
    userStats.error || filesRes.error || accessRes.error || activityRes.error
      ? "Some of this member's data failed to load. Figures below may be incomplete."
      : null;

  const stats = userStats.stats.get(memberId);

  // Every open is logged, so collapse to the latest open per file.
  const seenRuns = new Set<string>();
  const recentlyOpened: RecentlyOpenedFile[] = [];
  for (const row of (accessRes.data ?? []) as unknown as AccessRow[]) {
    if (seenRuns.has(row.search_run_id) || !row.search_runs) continue;
    seenRuns.add(row.search_run_id);
    recentlyOpened.push({
      runId: row.search_run_id,
      jobId: row.search_runs.job_id,
      jobTitle: row.search_runs.jobs?.title ?? "Untitled Role",
      accessedAt: row.accessed_at,
    });
    if (recentlyOpened.length === 8) break;
  }

  return {
    member: toUserPerformanceRow(
      memberProfile,
      stats,
      userStats.signIns.get(memberId) ?? null,
      memberProfile.teams?.name ?? null,
    ),
    pipelineCounts: pipelineCountsOf(stats ? [stats] : []),
    files: filesRes.rows,
    recentlyOpened,
    recentActivity: toActivityFeedItems(
      (activityRes.data ?? []) as ActivityLogRow[],
      new Map([[memberProfile.id, memberProfile.email]]),
    ),
    loadError,
  };
}
