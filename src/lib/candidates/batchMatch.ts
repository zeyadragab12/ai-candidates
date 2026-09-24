import type { SupabaseClient } from "@supabase/supabase-js";

import type { AIProvider } from "@/lib/ai/AIProvider";
import { matchAndPersistCandidate } from "@/lib/candidates/matchAndPersist";
import type { MatchingCandidateInput, MatchingJobInput } from "@/types/matching";

export interface BatchMatchCandidate {
  candidateId: string;
  input: MatchingCandidateInput;
  searchRunId: string | null;
}

export interface BatchMatchSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: (
    | { candidateId: string; success: true }
    | { candidateId: string; success: false; error: string }
  )[];
}

// Firing every match concurrently reliably hits AI provider rate limits
// (confirmed against the real Gemini free tier: 10 concurrent requests
// caused 9 of them to fail with a rate-limit error). Processing a few at a
// time keeps the batch working at realistic sizes without needing full
// retry/backoff (that's Phase 7's job).
const CONCURRENCY_LIMIT = 3;

async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex] as T);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

/**
 * Matches every candidate independently. One candidate's AI error, invalid
 * AI output, or DB write failure is recorded and skipped — it never aborts
 * the rest of the batch, since matchAndPersistCandidate never throws.
 */
export async function runBatchMatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  provider: AIProvider,
  jobId: string,
  jobInput: MatchingJobInput,
  candidates: BatchMatchCandidate[],
): Promise<BatchMatchSummary> {
  const results = await mapWithConcurrencyLimit(
    candidates,
    CONCURRENCY_LIMIT,
    ({ candidateId, input, searchRunId }) =>
      matchAndPersistCandidate(supabase, provider, jobId, jobInput, candidateId, input, searchRunId),
  );

  const succeeded = results.filter((r) => r.success).length;

  return {
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results: results.map((r) =>
      r.success
        ? { candidateId: r.candidateId, success: true }
        : { candidateId: r.candidateId, success: false, error: r.error },
    ),
  };
}
