import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activity/log";
import { requireRole } from "@/lib/auth/roles";
import { withErrorHandling } from "@/lib/errors";
import { teamCreateSchema } from "@/types/team";

// Admin-only: system-wide list of every team. A manager or HR user reads
// their own team via GET /api/teams/[id] instead (RLS scopes that to the
// team they belong to).
export const GET = withErrorHandling(async () => {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, manager_id, created_at, updated_at, profiles(count)")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load teams." }, { status: 500 });
  }

  return NextResponse.json({ teams: data });
});

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

  const parsed = teamCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid team data." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({ name: parsed.data.name, manager_id: parsed.data.managerId ?? null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create team." }, { status: 500 });
  }

  await logActivity(supabase, {
    userId: user.id,
    action: "team.created",
    entityType: "team",
    entityId: data.id,
    description: `Created team "${data.name}"`,
  });

  return NextResponse.json(data, { status: 201 });
});
