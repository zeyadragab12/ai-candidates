import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/lib/auth/roleDefinitions";
import { getDisplayName } from "@/lib/users/displayName";

/** One row of the `user_performance_stats()` SQL function. */
export interface UserStatsRow {
  user_id: string;
  jobs_count: number;
  runs_count: number;
  completed_runs: number;
  active_runs: number;
  failed_runs: number;
  candidates_count: number;
  new_count: number;
  reviewed_count: number;
  shortlisted_count: number;
  contacted_count: number;
  rejected_count: number;
  hired_count: number;
  run_avg_sum: number | string;
  run_avg_count: number;
  last_activity_at: string | null;
}

export interface ProfileRow {
  id: string;
  email: string;
  role: Role;
  team_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserPerformanceRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  teamId: string | null;
  teamName: string | null;
  isActive: boolean;
  jobs: number;
  runs: number;
  completedRuns: number;
  activeRuns: number;
  failedRuns: number;
  candidates: number;
  newCandidates: number;
  reviewed: number;
  shortlisted: number;
  contacted: number;
  rejected: number;
  hired: number;
  averageMatchQuality: number | null;
  lastActivityAt: string | null;
  lastSignInAt: string | null;
}

// Per-run averages are summed/counted in SQL so any grouping (user, team,
// org) can be combined without re-reading match rows: avg = sum / count.
export function averageOf(sum: number, count: number): number | null {
  return count > 0 ? Math.round(sum / count) : null;
}

export function sumStats(
  rows: UserStatsRow[],
  pick: (row: UserStatsRow) => number | string,
): number {
  return rows.reduce((total, row) => total + Number(pick(row)), 0);
}

export function combinedAverageMatch(rows: UserStatsRow[]): number | null {
  return averageOf(
    sumStats(rows, (row) => row.run_avg_sum),
    sumStats(rows, (row) => row.run_avg_count),
  );
}

export function pipelineCountsOf(rows: UserStatsRow[]): Record<string, number> {
  return {
    New: sumStats(rows, (row) => row.new_count),
    Reviewed: sumStats(rows, (row) => row.reviewed_count),
    Shortlisted: sumStats(rows, (row) => row.shortlisted_count),
    Contacted: sumStats(rows, (row) => row.contacted_count),
    Rejected: sumStats(rows, (row) => row.rejected_count),
    Hired: sumStats(rows, (row) => row.hired_count),
  };
}

/**
 * Loads per-user stats and last sign-ins. Both functions respect RLS, so
 * the result only ever covers users the caller is allowed to see.
 */
export async function loadUserStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  /** Counts only jobs/runs/candidates created in this window; all-time when omitted. */
  window?: { from: string | null; to: string | null },
): Promise<{
  stats: Map<string, UserStatsRow>;
  signIns: Map<string, string | null>;
  error: boolean;
}> {
  const [statsRes, signInsRes] = await Promise.all([
    supabase.rpc(
      "user_performance_stats",
      window ? { p_from: window.from, p_to: window.to } : {},
    ),
    supabase.rpc("profile_last_sign_ins"),
  ]);

  return {
    stats: new Map(((statsRes.data ?? []) as UserStatsRow[]).map((row) => [row.user_id, row])),
    signIns: new Map(
      ((signInsRes.data ?? []) as { user_id: string; last_sign_in_at: string | null }[]).map(
        (row) => [row.user_id, row.last_sign_in_at],
      ),
    ),
    error: Boolean(statsRes.error || signInsRes.error),
  };
}

export function toUserPerformanceRow(
  profile: ProfileRow,
  stats: UserStatsRow | undefined,
  lastSignInAt: string | null,
  teamName: string | null,
): UserPerformanceRow {
  return {
    id: profile.id,
    email: profile.email,
    name: getDisplayName(profile.email) ?? profile.email,
    role: profile.role,
    teamId: profile.team_id,
    teamName,
    isActive: profile.is_active,
    jobs: Number(stats?.jobs_count ?? 0),
    runs: Number(stats?.runs_count ?? 0),
    completedRuns: Number(stats?.completed_runs ?? 0),
    activeRuns: Number(stats?.active_runs ?? 0),
    failedRuns: Number(stats?.failed_runs ?? 0),
    candidates: Number(stats?.candidates_count ?? 0),
    newCandidates: Number(stats?.new_count ?? 0),
    reviewed: Number(stats?.reviewed_count ?? 0),
    shortlisted: Number(stats?.shortlisted_count ?? 0),
    contacted: Number(stats?.contacted_count ?? 0),
    rejected: Number(stats?.rejected_count ?? 0),
    hired: Number(stats?.hired_count ?? 0),
    averageMatchQuality: averageOf(
      Number(stats?.run_avg_sum ?? 0),
      Number(stats?.run_avg_count ?? 0),
    ),
    lastActivityAt: stats?.last_activity_at ?? null,
    lastSignInAt,
  };
}
