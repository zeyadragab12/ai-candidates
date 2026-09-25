import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export class InvalidManagerError extends Error {}

/**
 * Makes `managerId` the manager of `teamId`. Manager visibility in RLS is
 * keyed on the manager's own profiles.team_id (not teams.manager_id), so the
 * manager is also moved into the team, and removed as manager of any other
 * team — one manager, one team. Caller must be an admin (RLS enforces this
 * on both tables).
 */
export async function assignTeamManager(
  supabase: SupabaseClient,
  teamId: string,
  managerId: string | null,
): Promise<void> {
  if (managerId) {
    const { data: manager, error } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", managerId)
      .maybeSingle();
    if (error) throw error;
    if (!manager || manager.role !== "hr_manager" || !manager.is_active) {
      throw new InvalidManagerError("The selected manager must be an active HR Manager.");
    }

    const { error: clearError } = await supabase
      .from("teams")
      .update({ manager_id: null })
      .eq("manager_id", managerId)
      .neq("id", teamId);
    if (clearError) throw clearError;

    const { error: moveError } = await supabase
      .from("profiles")
      .update({ team_id: teamId })
      .eq("id", managerId);
    if (moveError) throw moveError;
  }

  const { error: assignError } = await supabase
    .from("teams")
    .update({ manager_id: managerId })
    .eq("id", teamId);
  if (assignError) throw assignError;
}
