import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ACTIVITY_FEED_COLUMNS,
  toActivityFeedItems,
  type ActivityFeedItem,
  type ActivityLogRow,
} from "@/lib/activity/feed";
import {
  hasActiveFilters,
  resolveDateWindow,
  type SourcingFileFilters,
} from "@/lib/manager/filters";
import {
  combinedAverageMatch,
  loadUserStats,
  pipelineCountsOf,
  sumStats,
  toUserPerformanceRow,
  type ProfileRow,
  type UserPerformanceRow,
  type UserStatsRow,
} from "@/lib/performance/userStats";
import { getDisplayName } from "@/lib/users/displayName";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

interface SourcingFileRpcRow {
  run_id: string;
  job_id: string;
  job_title: string;
  sourcing_status: string;
  owner_id: string;
  owner_email: string;
  created_by_email: string | null;
  created_at: string;
  total_candidates: number;
  shortlisted_candidates: number;
  unseen_candidates: number;
  average_match: number | null;
  last_accessed_by_email: string | null;
  last_accessed_by_id: string | null;
  last_activity_at: string | null;
}

export interface TeamSourcingFileRow {
  runId: string;
  jobId: string;
  jobTitle: string;
  sourcingStatus: string;
  ownerId: string;
  ownerName: string;
  /** Who started this run, when recorded; older runs predate that tracking. */
  startedBy: string | null;
  createdAt: string;
  totalCandidates: number;
  shortlistedCandidates: number;
  unseenCandidates: number;
  averageMatch: number | null;
  lastAccessedBy: string | null;
  /** True when the latest access was by someone other than the file's owner. */
  lastAccessedByOther: boolean;
  lastActivityAt: string | null;
}

export interface TeamSummary {
  id: string;
  name: string;
  managerId: string | null;
}

export interface TeamDashboardData {
  team: TeamSummary;
  totals: {
    members: number;
    activeMembers: number;
    jobs: number;
    activeRuns: number;
    completedRuns: number;
    failedRuns: number;
    candidates: number;
    shortlisted: number;
    contacted: number;
    rejected: number;
    unseen: number;
    averageMatchQuality: number | null;
  };
  pipelineCounts: Record<string, number>;
  members: UserPerformanceRow[];
  sourcingFiles: TeamSourcingFileRow[];
  filtersActive: boolean;
  recentActivity: ActivityFeedItem[];
  loadError: string | null;
}

const MAX_FILES = 200;

export async function fetchSourcingFiles(
  supabase: AnySupabaseClient,
  teamId: string,
  filters: Partial<SourcingFileFilters>,
  limit = MAX_FILES,
): Promise<{ rows: TeamSourcingFileRow[]; error: boolean }> {
  const window = filters.range
    ? resolveDateWindow(filters as SourcingFileFilters)
    : { from: null, to: null };

  const { data, error } = await supabase.rpc("team_sourcing_files", {
    p_team_id: teamId,
    p_member_id: filters.memberId ?? null,
    p_status: filters.status ?? null,
    p_job_title: filters.jobTitle ?? null,
    p_from: window.from,
    p_to: window.to,
    p_min_match: filters.minMatch ?? null,
    p_min_candidates: filters.minCandidates ?? null,
    p_limit: limit,
  });

  const rows = ((data ?? []) as SourcingFileRpcRow[]).map((row) => ({
    runId: row.run_id,
    jobId: row.job_id,
    jobTitle: row.job_title || "Untitled Role",
    sourcingStatus: row.sourcing_status,
    ownerId: row.owner_id,
    ownerName: getDisplayName(row.owner_email) ?? row.owner_email,
    startedBy: getDisplayName(row.created_by_email),
    createdAt: row.created_at,
    totalCandidates: Number(row.total_candidates),
    shortlistedCandidates: Number(row.shortlisted_candidates),
    unseenCandidates: Number(row.unseen_candidates),
    averageMatch: row.average_match,
    lastAccessedBy: getDisplayName(row.last_accessed_by_email),
    lastAccessedByOther:
      row.last_accessed_by_id !== null && row.last_accessed_by_id !== row.owner_id,
    lastActivityAt: row.last_activity_at,
  }));

  return { rows, error: Boolean(error) };
}

/** Returns null when the caller can't see the team (RLS) or it doesn't exist. */
export async function getTeamDashboardData(
  supabase: AnySupabaseClient,
  teamId: string,
  filters: SourcingFileFilters,
): Promise<TeamDashboardData | null> {
  const [teamRes, membersRes] = await Promise.all([
    supabase.from("teams").select("id, name, manager_id").eq("id", teamId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, email, role, team_id, is_active, created_at")
      .eq("team_id", teamId),
  ]);

  const team = teamRes.data as { id: string; name: string; manager_id: string | null } | null;
  if (teamRes.error || !team) return null;

  const profiles = (membersRes.data ?? []) as ProfileRow[];
  const memberIds = profiles.map((profile) => profile.id);
  const filtersActive = hasActiveFilters(filters);

  const [userStats, filesRes, allFilesRes, activityRes] = await Promise.all([
    loadUserStats(supabase),
    fetchSourcingFiles(supabase, teamId, filters),
    // The Unseen KPI covers the whole team, so it can't come from a filtered list.
    filtersActive
      ? fetchSourcingFiles(supabase, teamId, {}, 500)
      : Promise.resolve(null),
    memberIds.length > 0
      ? supabase
          .from("activity_log")
          .select(ACTIVITY_FEED_COLUMNS)
          .in("user_id", memberIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const loadError =
    membersRes.error || userStats.error || filesRes.error || allFilesRes?.error || activityRes.error
      ? "Some team data failed to load. Figures below may be incomplete."
      : null;

  const memberStats = memberIds
    .map((id) => userStats.stats.get(id))
    .filter((row): row is UserStatsRow => row !== undefined);

  const members = profiles
    .map((profile) =>
      toUserPerformanceRow(
        profile,
        userStats.stats.get(profile.id),
        userStats.signIns.get(profile.id) ?? null,
        team.name,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const unseenSource = allFilesRes?.rows ?? filesRes.rows;
  const emailsById = new Map(profiles.map((profile) => [profile.id, profile.email]));

  return {
    team: { id: team.id, name: team.name, managerId: team.manager_id },
    totals: {
      members: profiles.length,
      activeMembers: profiles.filter((profile) => profile.is_active).length,
      jobs: sumStats(memberStats, (row) => row.jobs_count),
      activeRuns: sumStats(memberStats, (row) => row.active_runs),
      completedRuns: sumStats(memberStats, (row) => row.completed_runs),
      failedRuns: sumStats(memberStats, (row) => row.failed_runs),
      candidates: sumStats(memberStats, (row) => row.candidates_count),
      shortlisted: sumStats(memberStats, (row) => row.shortlisted_count),
      contacted: sumStats(memberStats, (row) => row.contacted_count),
      rejected: sumStats(memberStats, (row) => row.rejected_count),
      unseen: unseenSource.reduce((total, row) => total + row.unseenCandidates, 0),
      averageMatchQuality: combinedAverageMatch(memberStats),
    },
    pipelineCounts: pipelineCountsOf(memberStats),
    members,
    sourcingFiles: filesRes.rows,
    filtersActive,
    recentActivity: toActivityFeedItems((activityRes.data ?? []) as ActivityLogRow[], emailsById),
    loadError,
  };
}
