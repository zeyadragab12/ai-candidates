import type { SupabaseClient } from "@supabase/supabase-js";

import { isAccessRequest, type Profile } from "@/lib/auth/access";
import type { ProfileRow } from "@/lib/performance/userStats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export interface ReportScope {
  kind: "user" | "team" | "org";
  label: string;
  teamId: string | null;
  members: ProfileRow[];
}

const PROFILE_COLUMNS = "id, email, role, team_id, is_active, created_at";

/**
 * Decides whose data a report covers, from the caller's role alone:
 *  - HR User: only themselves.
 *  - HR Manager: their own team (a requested team id is ignored).
 *  - Admin: the whole organization, or one team if `requestedTeamId` names one.
 * The member list is read through RLS, so even a wrong decision here can't
 * surface people the caller isn't allowed to see — and every report query
 * is RLS-scoped again on top of that.
 */
export async function resolveReportScope(
  supabase: AnySupabaseClient,
  profile: Profile,
  requestedTeamId: string | null,
): Promise<{ scope: ReportScope; teamOptions: { id: string; name: string }[] | null }> {
  if (profile.role === "admin") {
    const { data: teams } = await supabase.from("teams").select("id, name").order("name");
    const teamOptions = (teams ?? []) as { id: string; name: string }[];
    const team = teamOptions.find((option) => option.id === requestedTeamId);

    const query = supabase.from("profiles").select(PROFILE_COLUMNS);
    const { data } = team ? await query.eq("team_id", team.id) : await query;
    return {
      scope: {
        kind: team ? "team" : "org",
        label: team ? team.name : "Whole organization",
        teamId: team?.id ?? null,
        members: ((data ?? []) as ProfileRow[]).filter((member) => !isAccessRequest(member)),
      },
      teamOptions,
    };
  }

  if (profile.role === "hr_manager" && profile.team_id) {
    const [{ data: team }, { data: members }] = await Promise.all([
      supabase.from("teams").select("name").eq("id", profile.team_id).maybeSingle(),
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("team_id", profile.team_id),
    ]);
    return {
      scope: {
        kind: "team",
        label: (team?.name as string | undefined) ?? "My team",
        teamId: profile.team_id,
        members: (members ?? []) as ProfileRow[],
      },
      teamOptions: null,
    };
  }

  const { data: self } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", profile.id)
    .maybeSingle();
  return {
    scope: {
      kind: "user",
      label: "My work",
      teamId: null,
      members: self ? [self as ProfileRow] : [],
    },
    teamOptions: null,
  };
}
