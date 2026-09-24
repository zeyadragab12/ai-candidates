export interface CandidateSearchParams {
  query: string;
  location?: string;
  /** Google's `gl` two-letter country-restriction code (e.g. "eg"). Does
   * most of the actual work of biasing organic results to a country as a
   * whole — `location` alone is only a ranking hint. */
  countryCode?: string;
  /** Country-localized Google domain (e.g. "google.com.eg"). */
  googleDomain?: string;
  page?: number;
  limit?: number;
}

export interface CandidateSearchResult {
  source: string;
  source_url: string;
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  profile_url?: string;
  profile_image_url?: string;
  snippet?: string;
  skills?: string[];
  /** Only ever set from a structured source (e.g. an Apify LinkedIn profile
   * scrape's total tenure) — never guessed from free text. */
  experience_years?: number;
  /** Set by the Egypt location verification step (see
   * verifyEgyptLocation.ts): true = confirmed in Egypt, false = confirmed
   * elsewhere (filtered out before this ever reaches normalization), null =
   * couldn't be determined either way, undefined = the check never ran
   * (job location wasn't Egypt-scoped). */
  location_verified?: boolean | null;
}
