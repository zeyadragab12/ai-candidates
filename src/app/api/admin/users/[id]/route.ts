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
