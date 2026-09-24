import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/roles";
import { withErrorHandling } from "@/lib/errors";

// Admin-only: system-wide directory of every profile. RLS's
// admin_select_profiles policy also enforces this at the DB level, so even
// if this check were somehow bypassed the query itself returns nothing for
// a non-admin.
export const GET = withErrorHandling(async () => {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, team_id, is_active, created_at, teams(name)")
    .order("email", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }

  return NextResponse.json({ users: data });
});
