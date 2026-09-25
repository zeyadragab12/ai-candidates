import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activity/log";
import { requireRole } from "@/lib/auth/roles";
import { withErrorHandling } from "@/lib/errors";
import { profileUpdateSchema } from "@/types/team";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Admin-only: assign role/team/manager, or activate/deactivate a user.
// Backed by RLS's admin_update_profiles policy as a second enforcement
// layer.
export const PATCH = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid update." },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.teamId !== undefined) updates.team_id = parsed.data.teamId;
  if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  // An admin removing their own admin role or deactivating themselves could
  // leave nobody able to manage users; another admin must do it.
  const removesOwnAdmin =
    (updates.role !== undefined && updates.role !== "admin") || updates.is_active === false;
  if (id === user.id && removesOwnAdmin) {
    return NextResponse.json(
      { error: "You can't remove your own admin access. Ask another admin." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("id, email, role, team_id, is_active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Keep teams.manager_id consistent with the RLS model (manager sees the
  // team in their own profiles.team_id): a demoted, deactivated, or moved
  // manager stops being listed as manager of any team they no longer lead.
  let staleManagedTeams = supabase.from("teams").update({ manager_id: null }).eq("manager_id", id);
  if (data.role === "hr_manager" && data.is_active && data.team_id) {
    staleManagedTeams = staleManagedTeams.neq("id", data.team_id);
  }
  const { error: managerSyncError } = await staleManagedTeams;
  if (managerSyncError) {
    return NextResponse.json({ error: "Failed to update team manager." }, { status: 500 });
  }

  // An active HR Manager placed in a team that has no manager yet becomes
  // its manager, so the team doesn't show "Unassigned" while they're
  // effectively leading it. An existing manager is never replaced here —
  // that's an explicit choice on the Teams card.
  if (data.role === "hr_manager" && data.is_active && data.team_id) {
    const { error: assignError } = await supabase
      .from("teams")
      .update({ manager_id: data.id })
      .eq("id", data.team_id)
      .is("manager_id", null);
    if (assignError) {
      return NextResponse.json({ error: "Failed to update team manager." }, { status: 500 });
    }
  }

  await logActivity(supabase, {
    userId: user.id,
    action: "team.user_updated",
    entityType: "profile",
    entityId: data.id,
    description: `Updated ${data.email}: ${Object.keys(updates).join(", ")}`,
    metadata: updates,
  });

  return NextResponse.json(data);
});
