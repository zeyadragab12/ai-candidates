import type { CandidateSearchParams, CandidateSearchResult } from "@/types/search";

export interface SearchProvider {
  searchCandidates(
    params: CandidateSearchParams,
  ): Promise<CandidateSearchResult[]>;
}

export class SearchProviderError extends Error {
  constructor(provider: string, cause?: unknown) {
    super(`Search provider "${provider}" failed to return results.`);
    this.name = "SearchProviderError";
    this.cause = cause;
  }
}
