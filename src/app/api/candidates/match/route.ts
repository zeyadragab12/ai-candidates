import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider } from "@/lib/ai";
import { requireUser } from "@/lib/api/requireUser";
import { matchAndPersistCandidate } from "@/lib/candidates/matchAndPersist";
import {
  candidateRowToMatchingInput,
  jobRowToMatchingInput,
} from "@/lib/candidates/mapToMatchingInput";
import { withErrorHandling } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const requestSchema = z.object({
  candidateId: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
});

export const POST = withErrorHandling(async (request: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  await enforceRateLimit(
    `ai:${auth.user.id}`,
    RATE_LIMITS.aiRequest.limit,
    RATE_LIMITS.aiRequest.windowSeconds,
  );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { candidateId, jobId } = parsed.data;

  const [jobResult, candidateResult, jobCandidateResult] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
    supabase.from("candidates").select("*").eq("id", candidateId).maybeSingle(),
    supabase
      .from("job_candidates")
      .select("search_run_id")
      .eq("job_id", jobId)
      .eq("candidate_id", candidateId)
      .maybeSingle(),
  ]);

  if (jobResult.error || candidateResult.error) {
    return NextResponse.json(
      { error: "Failed to load job or candidate." },
      { status: 500 },
    );
  }
  if (!jobResult.data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  if (!candidateResult.data) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const jobInput = jobRowToMatchingInput(jobResult.data);
  const candidateInput = candidateRowToMatchingInput(candidateResult.data);

  const result = await matchAndPersistCandidate(
    supabase,
    getAIProvider(),
    jobId,
    jobInput,
    candidateId,
    candidateInput,
    jobCandidateResult.data?.search_run_id ?? null,
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result.match);
});
