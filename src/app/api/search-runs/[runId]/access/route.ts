import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

/**
 * Records that the current user opened this sourcing run's candidate list.
 * Used to compute the dashboard's "Last Accessed By" / "Last Activity Time"
 * columns — every open is logged, so "last" is just the most recent row.
 */
export const POST = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;
  const { runId } = await params;

  const { error } = await supabase.from("search_run_access").insert({
    search_run_id: runId,
    user_id: user.id,
    user_email: user.email,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to record run access." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
});
