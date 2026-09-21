import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load candidate." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  let match = null;
  if (jobId) {
    const matchResult = await supabase
      .from("candidate_matches")
      .select("*")
      .eq("job_id", jobId)
      .eq("candidate_id", id)
      .maybeSingle();
    match = matchResult.data ?? null;
  }

  return NextResponse.json({ ...data, match });
});

export const DELETE = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  // candidate_matches, candidate_notes, candidate_status_history, and
  // job_candidates all reference candidates with ON DELETE CASCADE, so this
  // single delete removes every dependent row for this candidate without
  // touching the jobs it was ever linked to.
  const { data, error } = await supabase
    .from("candidates")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete candidate." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
