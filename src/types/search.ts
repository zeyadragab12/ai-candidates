export interface CandidateSearchParams {
  query: string;
  location?: string;
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
  snippet?: string;
  skills?: string[];
}
