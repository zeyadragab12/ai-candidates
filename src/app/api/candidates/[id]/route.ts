import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import { forbidUnlessOwner } from "@/lib/auth/ownership";
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

    // Marks this candidate as seen by the current user for this job, so the
    // dashboard's Unseen Candidates count stays accurate. Best-effort: a
    // failure here should never break loading the candidate itself.
    await supabase.from("candidate_views").upsert(
      { user_id: auth.user.id, candidate_id: id, job_id: jobId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,candidate_id,job_id" },
    );
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
  const existing = await supabase
    .from("candidates")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: "Failed to load candidate." }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }
  const forbidden = forbidUnlessOwner(existing.data.user_id, auth.user.id, "candidate");
  if (forbidden) return forbidden;

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
