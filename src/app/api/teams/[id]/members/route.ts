import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/roles";
import { withErrorHandling } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Manager-or-admin only: RLS on `profiles` (admin_select_profiles /
// manager_select_team_profiles) means an hr_manager only ever gets rows
// back for their own team regardless of which `id` is requested here, and
// a plain hr_user gets none (own_select_profile only returns their own
// row) -- but they're rejected with a 403 up front rather than a
// confusingly-empty 200.
export const GET = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireRole(["admin", "hr_manager"]);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, team_id, is_active, created_at")
    .eq("team_id", id)
    .order("email", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load team members." }, { status: 500 });
  }

  return NextResponse.json({ members: data });
});
