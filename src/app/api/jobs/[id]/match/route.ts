import { NextResponse } from "next/server";

import { getAIProvider } from "@/lib/ai";
import { requireUser } from "@/lib/api/requireUser";
import { runBatchMatch } from "@/lib/candidates/batchMatch";
import {
  candidateRowToMatchingInput,
  jobRowToMatchingInput,
} from "@/lib/candidates/mapToMatchingInput";
import { withErrorHandling } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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

  const { data: linked, error: linkError } = await supabase
    .from("job_candidates")
    .select("candidate_id, candidates(*)")
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
  }));

  const summary = await runBatchMatch(supabase, provider, jobId, jobInput, batchInput);

  return NextResponse.json(summary);
});
