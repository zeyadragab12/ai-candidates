import type { AIProvider } from "@/lib/ai/AIProvider";
import { verifyEgyptLocationWithAI } from "@/lib/ai/prompts/location-verification";
import { mentionsEgyptLocation } from "@/lib/candidates/egyptLocations";
import type { CandidateSearchResult } from "@/types/search";

// Caps how many AI verification calls run at once — enough to keep a search
// run's total latency reasonable without hammering OpenAI with one request
// per candidate simultaneously.
const AI_VERIFICATION_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current] as T);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

/**
 * Filters out candidates confirmed to be based outside Egypt, using two
 * tiers: a free deterministic check against candidate.location text first
 * (resolves most cases with zero AI cost), falling back to an AI read of
 * the candidate's headline/summary/company only when location is missing
 * entirely. A candidate whose status stays unresolved (null) is KEPT, not
 * excluded — location is frequently missing (Apify enrichment is optional
 * and capped), and treating "unknown" as "reject" would silently gut most
 * of the funnel. Only a confirmed non-Egypt match (Tier 1's deterministic
 * mismatch) is dropped; the AI tier itself is asked to return null rather
 * than false whenever it isn't confident, so it practically never causes an
 * exclusion.
 */
export async function filterToEgyptCandidates(
  results: CandidateSearchResult[],
  aiProvider: AIProvider,
): Promise<CandidateSearchResult[]> {
  const verified = await mapWithConcurrency(
    results,
    AI_VERIFICATION_CONCURRENCY,
    async (result): Promise<CandidateSearchResult> => {
      if (result.location) {
        const inEgypt = mentionsEgyptLocation(result.location);
        return { ...result, location_verified: inEgypt };
      }

      const aiResult = await verifyEgyptLocationWithAI(
        {
          headline: result.title ?? null,
          summary: result.snippet ?? null,
          currentCompany: result.company ?? null,
        },
        aiProvider,
      ).catch(() => ({ in_egypt: null as boolean | null, evidence: "" }));

      return { ...result, location_verified: aiResult.in_egypt };
    },
  );

  return verified.filter((result) => result.location_verified !== false);
}
