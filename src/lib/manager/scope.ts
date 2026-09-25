import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getProfile, type Profile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ManagerScope {
  supabase: SupabaseClient;
  user: User;
  profile: Profile;
  /** The team this page shows, or null if an HR Manager has no team yet. */
  teamId: string | null;
  /** Admins can switch teams; HR Managers are pinned to their own. */
  teamOptions: { id: string; name: string }[] | null;
}

/**
 * Resolves which team a manager-level page may show. An HR Manager always
 * gets their own team — a `teamId` in the URL is ignored for them, so it
 * can't be used to point at another team. Admins may pick any team.
 * Everyone else is sent back to their own dashboard. RLS enforces the same
 * boundaries again on every query the page makes.
 */
export async function resolveManagerScope(requestedTeamId: string | null): Promise<ManagerScope> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile || !profile.is_active) redirect("/login");

  if (profile.role === "hr_manager") {
    return { supabase, user, profile, teamId: profile.team_id, teamOptions: null };
  }

  if (profile.role === "admin") {
    const { data } = await supabase.from("teams").select("id, name").order("name");
    const teamOptions = (data ?? []) as { id: string; name: string }[];
    const teamId =
      teamOptions.find((team) => team.id === requestedTeamId)?.id ?? teamOptions[0]?.id ?? null;
    return { supabase, user, profile, teamId, teamOptions };
  }

  redirect("/dashboard");
}
