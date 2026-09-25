import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activity/log";
import { ROLE_LABELS } from "@/lib/auth/roleDefinitions";
import { requireRole } from "@/lib/auth/roles";
import { withErrorHandling } from "@/lib/errors";
import { assignTeamManager, InvalidManagerError } from "@/lib/teams/assignManager";
import { inviteSchema } from "@/types/team";

/** Escapes ILIKE wildcards: `_` is common in email addresses. */
function exactIlike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * POST (admin): give an email access to the app with a role and team.
 *  - Already has an active profile → 409.
 *  - Has an inactive profile (an access request, or a deactivated user) →
 *    activated immediately with the given role/team.
 *  - Never signed in → queued in pending_role_assignments; the signup
 *    trigger applies it (and grants access) on their first sign-in.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid invite." },
      { status: 400 },
    );
  }
  const { email, role } = parsed.data;
  const teamId = parsed.data.teamId ?? null;

  if (teamId) {
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle();
    if (!team) return NextResponse.json({ error: "Team not found." }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id, is_active")
    .ilike("email", exactIlike(email))
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: "Failed to look up the user." }, { status: 500 });
  }

  if (existing?.is_active) {
    return NextResponse.json({ error: "This person already has access." }, { status: 409 });
  }

  if (existing) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: true, role, team_id: teamId })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: "Failed to grant access." }, { status: 500 });
    }
    if (role === "hr_manager" && teamId) {
      try {
        await assignTeamManager(supabase, teamId, existing.id);
      } catch (managerError) {
        if (!(managerError instanceof InvalidManagerError)) throw managerError;
      }
    }
  } else {
    const { error } = await supabase
      .from("pending_role_assignments")
      .upsert({ email, role, team_id: teamId, created_by: user.id }, { onConflict: "email" });
    if (error) {
      return NextResponse.json({ error: "Failed to save the invite." }, { status: 500 });
    }
  }

  await logActivity(supabase, {
    userId: user.id,
    action: existing ? "team.access_granted" : "team.user_invited",
    entityType: "profile",
    entityId: existing?.id ?? null,
    description: existing
      ? `Granted ${email} access as ${ROLE_LABELS[role]}`
      : `Invited ${email} as ${ROLE_LABELS[role]}`,
    metadata: { email, role, teamId },
  });

  return NextResponse.json(
    { status: existing ? "activated" : "invited" },
    { status: existing ? 200 : 201 },
  );
});

/** DELETE (admin) ?email=…: withdraw an invite that hasn't been used yet. */
export const DELETE = withErrorHandling(async (request: Request) => {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const parsed = inviteSchema.shape.email.safeParse(new URL(request.url).searchParams.get("email"));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pending_role_assignments")
    .delete()
    .eq("email", parsed.data)
    .select("email");
  if (error) {
    return NextResponse.json({ error: "Failed to withdraw the invite." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  await logActivity(supabase, {
    userId: user.id,
    action: "team.invite_withdrawn",
    entityType: "profile",
    description: `Withdrew the invite for ${parsed.data}`,
    metadata: { email: parsed.data },
  });

  return NextResponse.json({ ok: true });
});
