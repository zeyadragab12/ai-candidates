import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activity/log";
import { getAIProvider } from "@/lib/ai";
import { requireUser } from "@/lib/api/requireUser";
import { forbidUnlessOwner } from "@/lib/auth/ownership";
import { runBatchMatch } from "@/lib/candidates/batchMatch";
import {
  candidateRowToMatchingInput,
  jobRowToMatchingInput,
} from "@/lib/candidates/mapToMatchingInput";
import { withErrorHandling } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/** A candidate scoring at least this counts as a "high-quality" find. */
const STRONG_MATCH_THRESHOLD = 80;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id: jobId } = await params;

  await enforceRateLimit(
    `ai:${auth.user.id}`,
    RATE_LIMITS.aiRequest.limit,
    RATE_LIMITS.aiRequest.windowSeconds,
  );

  const job = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (job.error) {
    return NextResponse.json({ error: "Failed to load job." }, { status: 500 });
  }
  if (!job.data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  const forbidden = forbidUnlessOwner(job.data.user_id, auth.user.id, "job");
  if (forbidden) return forbidden;

  const { data: linked, error: linkError } = await supabase
    .from("job_candidates")
    .select("candidate_id, search_run_id, candidates(*)")
    .eq("job_id", jobId);

  if (linkError) {
    return NextResponse.json(
      { error: "Failed to load candidates for this job." },
      { status: 500 },
    );
  }

  const candidates = linked ?? [];
  if (candidates.length === 0) {
    return NextResponse.json({ total: 0, succeeded: 0, failed: 0, results: [] });
  }

  const provider = getAIProvider();
  const jobInput = jobRowToMatchingInput(job.data);
  const batchInput = candidates.map((row) => ({
    candidateId: row.candidate_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: candidateRowToMatchingInput(row.candidates as any),
    searchRunId: (row as { search_run_id: string | null }).search_run_id,
  }));

  const summary = await runBatchMatch(supabase, provider, jobId, jobInput, batchInput);

  const scoredIds = summary.results.filter((r) => r.success).map((r) => r.candidateId);
  if (scoredIds.length > 0) {
    const { count: strongMatches } = await supabase
      .from("candidate_matches")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .in("candidate_id", scoredIds)
      .gte("match_score", STRONG_MATCH_THRESHOLD);

    // A non-zero strongMatches also notifies the owner's manager (DB trigger).
    await logActivity(supabase, {
      userId: auth.user.id,
      action: "job.candidates_scored",
      entityType: "job",
      entityId: jobId,
      description: `Scored ${scoredIds.length} candidates for "${job.data.title}" — ${strongMatches ?? 0} strong ${strongMatches === 1 ? "match" : "matches"} (${STRONG_MATCH_THRESHOLD}%+)`,
      metadata: {
        jobId,
        scored: scoredIds.length,
        strongMatches: strongMatches ?? 0,
        threshold: STRONG_MATCH_THRESHOLD,
      },
    });
  }

  return NextResponse.json(summary);
});
