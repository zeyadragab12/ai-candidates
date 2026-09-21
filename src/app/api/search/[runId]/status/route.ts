import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export const GET = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { runId } = await params;

  // RLS on search_runs already scopes this to runs on the caller's own
  // jobs — a run belonging to another user's job simply won't be found.
  const { data, error } = await supabase
    .from("search_runs")
    .select(
      "id, job_id, provider, status, total_results, candidates_found, candidates_new, credits_used, error, started_at, completed_at, created_at",
    )
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load search run status." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Search run not found." }, { status: 404 });
  }

  return NextResponse.json(data);
});
