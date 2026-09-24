import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/roles";
import { withErrorHandling } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Any authenticated profile may request a team by id, but RLS on `teams`
// (admin_select_teams / member_select_own_team) only ever returns a row if
// the caller is an admin or belongs to that team — an hr_user or hr_manager
// asking for a different team's id gets a 404, not another team's data.
export const GET = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireRole(["admin", "hr_manager", "hr_user"]);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, manager_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load team." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  return NextResponse.json(data);
});
