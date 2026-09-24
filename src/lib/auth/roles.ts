import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { requireUser } from "@/lib/api/requireUser";
import { createClient } from "@/lib/supabase/server";

export const ROLES = ["admin", "hr_manager", "hr_user"] as const;
export type Role = (typeof ROLES)[number];

export interface Profile {
  id: string;
  email: string;
  role: Role;
  team_id: string | null;
  is_active: boolean;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, team_id, is_active")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Same gate as requireUser, but also loads the caller's profile and rejects
 * unless their role is one of `allowedRoles`. This is enforced again at the
 * database level by RLS on every table the resulting handler touches — this
 * check exists to fail fast with a clear 403 rather than relying solely on
 * RLS silently returning empty results.
 */
export async function requireRole(
  allowedRoles: readonly Role[],
): Promise<
  | { user: User; supabase: SupabaseClient; profile: Profile }
  | { error: NextResponse }
> {
  const auth = await requireUser();
  if ("error" in auth) return auth;

  const profile = await getProfile(auth.supabase, auth.user.id);
  if (!profile || !profile.is_active) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!allowedRoles.includes(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: auth.user, supabase: auth.supabase, profile };
}
