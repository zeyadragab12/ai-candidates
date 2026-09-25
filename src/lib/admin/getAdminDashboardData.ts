import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/lib/auth/roleDefinitions";
import { getDisplayName } from "@/lib/users/displayName";

interface UserStatsRow {
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
  run_avg_sum: number | string;
  run_avg_count: number;
  last_activity_at: string | null;
}

interface ProfileRow {
  id: string;
  email: string;
  role: Role;
  team_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface TeamRow {
  id: string;
  name: string;
  manager_id: string | null;
}

interface ActivityRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
}

export interface AdminUserRow {
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
  candidates: number;
  shortlisted: number;
  contacted: number;
  rejected: number;
  averageMatchQuality: number | null;
  lastActivityAt: string | null;
  lastSignInAt: string | null;
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

export interface AdminActivityRow {
  id: string;
  actorName: string;
  action: string;
  description: string;
  createdAt: string;
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
  users: AdminUserRow[];
  teams: AdminTeamRow[];
  teamOptions: { id: string; name: string }[];
  managerOptions: { id: string; name: string }[];
  recentActivity: AdminActivityRow[];
  loadError: string | null;
}

// Per-run averages are summed/counted in SQL so any grouping (user, team,
// org) can be combined without re-reading match rows: avg = sum / count.
function averageOf(sum: number, count: number): number | null {
  return count > 0 ? Math.round(sum / count) : null;
}

export async function getAdminDashboardData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<AdminDashboardData> {
  const [statsRes, signInsRes, profilesRes, teamsRes, activityRes] = await Promise.all([
    supabase.rpc("user_performance_stats"),
    supabase.rpc("profile_last_sign_ins"),
    supabase.from("profiles").select("id, email, role, team_id, is_active, created_at"),
    supabase.from("teams").select("id, name, manager_id").order("name"),
    supabase
      .from("activity_log")
      .select("id, user_id, action, entity_type, description, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const loadError =
    statsRes.error || signInsRes.error || profilesRes.error || teamsRes.error || activityRes.error
      ? "Some admin data failed to load. Figures below may be incomplete."
      : null;

  const stats = new Map(
    ((statsRes.data ?? []) as UserStatsRow[]).map((row) => [row.user_id, row]),
  );
  const signIns = new Map(
    ((signInsRes.data ?? []) as { user_id: string; last_sign_in_at: string | null }[]).map(
      (row) => [row.user_id, row.last_sign_in_at],
    ),
  );
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const teams = (teamsRes.data ?? []) as TeamRow[];
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const emailsById = new Map(profiles.map((profile) => [profile.id, profile.email]));

  const users: AdminUserRow[] = profiles
    .map((profile) => {
      const s = stats.get(profile.id);
      return {
        id: profile.id,
        email: profile.email,
        name: getDisplayName(profile.email) ?? profile.email,
        role: profile.role,
        teamId: profile.team_id,
        teamName: profile.team_id ? (teamNames.get(profile.team_id) ?? null) : null,
        isActive: profile.is_active,
        jobs: Number(s?.jobs_count ?? 0),
        runs: Number(s?.runs_count ?? 0),
        completedRuns: Number(s?.completed_runs ?? 0),
        activeRuns: Number(s?.active_runs ?? 0),
        candidates: Number(s?.candidates_count ?? 0),
        shortlisted: Number(s?.shortlisted_count ?? 0),
        contacted: Number(s?.contacted_count ?? 0),
        rejected: Number(s?.rejected_count ?? 0),
        averageMatchQuality: averageOf(Number(s?.run_avg_sum ?? 0), Number(s?.run_avg_count ?? 0)),
        lastActivityAt: s?.last_activity_at ?? null,
        lastSignInAt: signIns.get(profile.id) ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const allStats = Array.from(stats.values());
  const sum = (pick: (row: UserStatsRow) => number | string) =>
    allStats.reduce((total, row) => total + Number(pick(row)), 0);

  const teamRows: AdminTeamRow[] = teams.map((team) => {
    const members = profiles.filter((profile) => profile.team_id === team.id);
    const memberStats = members
      .map((member) => stats.get(member.id))
      .filter((row): row is UserStatsRow => row !== undefined);
    const teamSum = (pick: (row: UserStatsRow) => number | string) =>
      memberStats.reduce((total, row) => total + Number(pick(row)), 0);

    return {
      id: team.id,
      name: team.name,
      managerId: team.manager_id,
      members: members.length,
      activeMembers: members.filter((member) => member.is_active).length,
      jobs: teamSum((row) => row.jobs_count),
      activeRuns: teamSum((row) => row.active_runs),
      candidates: teamSum((row) => row.candidates_count),
      shortlisted: teamSum((row) => row.shortlisted_count),
      averageMatchQuality: averageOf(
        teamSum((row) => row.run_avg_sum),
        teamSum((row) => row.run_avg_count),
      ),
    };
  });

  const recentActivity: AdminActivityRow[] = ((activityRes.data ?? []) as ActivityRow[]).map(
    (row) => {
      const email = row.user_id ? emailsById.get(row.user_id) : null;
      return {
        id: row.id,
        actorName: getDisplayName(email) ?? "Unknown user",
        action: row.action,
        description: row.description,
        createdAt: row.created_at,
      };
    },
  );

  return {
    totals: {
      users: profiles.length,
      activeUsers: profiles.filter((profile) => profile.is_active).length,
      teams: teams.length,
      jobs: sum((row) => row.jobs_count),
      activeRuns: sum((row) => row.active_runs),
      completedRuns: sum((row) => row.completed_runs),
      failedRuns: sum((row) => row.failed_runs),
      candidates: sum((row) => row.candidates_count),
      shortlisted: sum((row) => row.shortlisted_count),
      contacted: sum((row) => row.contacted_count),
      rejected: sum((row) => row.rejected_count),
      averageMatchQuality: averageOf(
        sum((row) => row.run_avg_sum),
        sum((row) => row.run_avg_count),
      ),
    },
    pipelineCounts: {
      New: sum((row) => row.new_count),
      Reviewed: sum((row) => row.reviewed_count),
      Shortlisted: sum((row) => row.shortlisted_count),
      Contacted: sum((row) => row.contacted_count),
      Rejected: sum((row) => row.rejected_count),
    },
    users,
    teams: teamRows,
    teamOptions: teams.map((team) => ({ id: team.id, name: team.name })),
    managerOptions: users
      .filter((user) => user.role === "hr_manager" && user.isActive)
      .map((user) => ({ id: user.id, name: user.name })),
    recentActivity,
    loadError,
  };
}
