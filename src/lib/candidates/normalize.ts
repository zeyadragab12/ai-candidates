import type { CandidateSearchResult } from "@/types/search";
import type { NormalizedCandidate } from "@/types/candidate";

/**
 * Maps a raw search provider result into the app's normalized candidate
 * shape. Deliberately conservative: a field is only ever set from data the
 * provider actually returned. `experience_years` in particular is always
 * null here — search snippets never contain a reliable, structured years-
 * of-experience figure, and guessing one from free text would risk
 * fabricating candidate information, which is never acceptable.
 */
export function normalizeCandidate(
  raw: CandidateSearchResult,
): NormalizedCandidate {
  return {
    name: raw.name ?? null,
    headline: raw.title ?? null,
    current_company: raw.company ?? null,
    location: raw.location ?? null,
    profile_url: raw.profile_url ?? null,
    source: raw.source,
    source_url: raw.source_url,
    summary: raw.snippet ?? null,
    skills: raw.skills ?? [],
    experience_years: null,
  };
}
