import type { SupabaseClient } from "@supabase/supabase-js";

import { AIProviderError, AIResponseValidationError, type AIProvider } from "@/lib/ai/AIProvider";
import { matchCandidateToJob } from "@/lib/ai/prompts/candidate-matching";
import type { MatchingCandidateInput, MatchingJobInput } from "@/types/matching";

export interface MatchAndPersistSuccess {
  success: true;
  candidateId: string;
  match: Record<string, unknown>;
}

export interface MatchAndPersistFailure {
  success: false;
  candidateId: string;
  error: string;
}

export type MatchAndPersistResult = MatchAndPersistSuccess | MatchAndPersistFailure;

/**
 * Runs AI matching for one candidate against one job and persists the
 * result. On any failure (AI error, invalid AI output, DB error), nothing
 * is written — a malformed or failed match is reported back, never
 * silently persisted as if it were a real score.
 */
export async function matchAndPersistCandidate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  provider: AIProvider,
  jobId: string,
  jobInput: MatchingJobInput,
  candidateId: string,
  candidateInput: MatchingCandidateInput,
  searchRunId: string | null,
): Promise<MatchAndPersistResult> {
  let result;
  try {
    result = await matchCandidateToJob(jobInput, candidateInput, provider);
  } catch (error) {
    if (error instanceof AIResponseValidationError) {
      return {
        success: false,
        candidateId,
        error: "The AI returned an unexpected response for this candidate.",
      };
    }
    if (error instanceof AIProviderError) {
      return {
        success: false,
        candidateId,
        error: "The AI service was unavailable for this candidate.",
      };
    }
    return { success: false, candidateId, error: "Failed to score this candidate." };
  }

  const { summary, ...scores } = result;

  const { data, error: dbError } = await supabase
    .from("candidate_matches")
    .upsert(
      {
        job_id: jobId,
        candidate_id: candidateId,
        search_run_id: searchRunId,
        ...scores,
        ai_summary: summary,
      },
      { onConflict: "job_id,candidate_id" },
    )
    .select()
    .single();

  if (dbError) {
    return { success: false, candidateId, error: "Failed to save the match result." };
  }

  return { success: true, candidateId, match: data };
}
