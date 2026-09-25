import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/lib/auth/roleDefinitions";

export interface Profile {
  id: string;
  email: string;
  role: Role;
  team_id: string | null;
  is_active: boolean;
}

/**
 * Loads the caller's profile. Access to the app is granted by an active
 * profile — there's no separate allowlist — so callers treat a missing or
 * inactive profile as "not allowed in".
 */
export async function getProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, team_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

export async function hasAppAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<boolean> {
  const profile = await getProfile(supabase, userId);
  return profile?.is_active === true;
}

/**
 * Someone who signed in without being invited: their profile was created
 * inactive, with no team and the default role. Admins see these as access
 * requests rather than as users.
 */
export function isAccessRequest(profile: {
  role: string;
  team_id: string | null;
  is_active: boolean;
}): boolean {
  return !profile.is_active && profile.team_id === null && profile.role === "hr_user";
}
