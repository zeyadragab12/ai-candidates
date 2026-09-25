import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ACTIVITY_FEED_COLUMNS,
  toActivityFeedItems,
  type ActivityFeedItem,
  type ActivityLogRow,
} from "@/lib/activity/feed";
import { isRejectedSignup } from "@/lib/auth/allowlist";
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

interface TeamRow {
  id: string;
  name: string;
  manager_id: string | null;
}

export interface AdminTeamRow {
  id: string;
  name: string;
  managerId: string | null;
  members: number;
  activeMembers: number;
  jobs: number;
  activeRuns: number;
  candidates: number;
  shortlisted: number;
  averageMatchQuality: number | null;
}

export interface AdminDashboardData {
  totals: {
    users: number;
    activeUsers: number;
    teams: number;
    jobs: number;
    activeRuns: number;
    completedRuns: number;
    failedRuns: number;
    candidates: number;
    shortlisted: number;
    contacted: number;
    rejected: number;
    averageMatchQuality: number | null;
  };
  pipelineCounts: Record<string, number>;
  users: UserPerformanceRow[];
  teams: AdminTeamRow[];
  teamOptions: { id: string; name: string }[];
  managerOptions: { id: string; name: string }[];
  recentActivity: ActivityFeedItem[];
  loadError: string | null;
}

export async function getAdminDashboardData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<AdminDashboardData> {
  const [userStats, profilesRes, teamsRes, activityRes] = await Promise.all([
    loadUserStats(supabase),
    supabase.from("profiles").select("id, email, role, team_id, is_active, created_at"),
    supabase.from("teams").select("id, name, manager_id").order("name"),
    supabase
      .from("activity_log")
      .select(ACTIVITY_FEED_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const loadError =
    userStats.error || profilesRes.error || teamsRes.error || activityRes.error
      ? "Some admin data failed to load. Figures below may be incomplete."
      : null;

  const { stats, signIns } = userStats;
  const profiles = ((profilesRes.data ?? []) as ProfileRow[]).filter(
    (profile) => !isRejectedSignup(profile),
  );
  const teams = (teamsRes.data ?? []) as TeamRow[];
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const emailsById = new Map(profiles.map((profile) => [profile.id, profile.email]));

  const users = profiles
    .map((profile) =>
      toUserPerformanceRow(
        profile,
        stats.get(profile.id),
        signIns.get(profile.id) ?? null,
        profile.team_id ? (teamNames.get(profile.team_id) ?? null) : null,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const allStats = profiles
    .map((profile) => stats.get(profile.id))
    .filter((row): row is UserStatsRow => row !== undefined);

  const teamRows: AdminTeamRow[] = teams.map((team) => {
    const members = profiles.filter((profile) => profile.team_id === team.id);
    const memberStats = members
      .map((member) => stats.get(member.id))
      .filter((row): row is UserStatsRow => row !== undefined);

    return {
      id: team.id,
      name: team.name,
      managerId: team.manager_id,
      members: members.length,
      activeMembers: members.filter((member) => member.is_active).length,
      jobs: sumStats(memberStats, (row) => row.jobs_count),
      activeRuns: sumStats(memberStats, (row) => row.active_runs),
      candidates: sumStats(memberStats, (row) => row.candidates_count),
      shortlisted: sumStats(memberStats, (row) => row.shortlisted_count),
      averageMatchQuality: combinedAverageMatch(memberStats),
    };
  });

  return {
    totals: {
      users: profiles.length,
      activeUsers: profiles.filter((profile) => profile.is_active).length,
      teams: teams.length,
      jobs: sumStats(allStats, (row) => row.jobs_count),
      activeRuns: sumStats(allStats, (row) => row.active_runs),
      completedRuns: sumStats(allStats, (row) => row.completed_runs),
      failedRuns: sumStats(allStats, (row) => row.failed_runs),
      candidates: sumStats(allStats, (row) => row.candidates_count),
      shortlisted: sumStats(allStats, (row) => row.shortlisted_count),
      contacted: sumStats(allStats, (row) => row.contacted_count),
      rejected: sumStats(allStats, (row) => row.rejected_count),
      averageMatchQuality: combinedAverageMatch(allStats),
    },
    pipelineCounts: pipelineCountsOf(allStats),
    users,
    teams: teamRows,
    teamOptions: teams.map((team) => ({ id: team.id, name: team.name })),
    managerOptions: users
      .filter((user) => user.role === "hr_manager" && user.isActive)
      .map((user) => ({ id: user.id, name: user.name })),
    recentActivity: toActivityFeedItems((activityRes.data ?? []) as ActivityLogRow[], emailsById),
    loadError,
  };
}
