import { SearchProviderError, type SearchProvider } from "@/lib/search/SearchProvider";
import { isRetryableStatus, withRetry } from "@/lib/retry";
import type { CandidateSearchParams, CandidateSearchResult } from "@/types/search";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

// Real SerpApi responses land well under 2s even for long boolean queries;
// this is a generous ceiling, not a target. Without it, a stalled connection
// (no response, no error — fetch just never settles) hangs the fetch promise
// forever, which hangs the whole search run in "running" with no way to
// recover — observed in production use before this was added.
const REQUEST_TIMEOUT_MS = 15000;

const RETRY_OPTIONS = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 4000,
};

/** Marks the error with the HTTP status so withRetry's isRetryable can see it
 * without re-fetching or re-parsing the response. */
class SerpApiHttpError extends Error {
  constructor(public readonly status: number) {
    super(`SerpApi request failed with status ${status}`);
  }
}

interface SerpApiOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  snippet_highlighted_words?: string[];
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
}

/**
 * Parses a search result title into name/title/company using the common
 * "Name - Job Title - Company | Site" pattern seen in public profile
 * listings. This is a best-effort heuristic over noisy search-engine
 * output, not a guarantee — sparse/inconsistent results are expected for
 * ordinary corporate roles. Never fabricates a field the title doesn't
 * actually contain.
 */
function parseTitleSegments(title: string | undefined): {
  name?: string;
  jobTitle?: string;
  company?: string;
} {
  if (!title) return {};

  const withoutSiteSuffix = title.split("|")[0]?.trim() ?? title;
  const segments = withoutSiteSuffix
    .split(" - ")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return {
    name: segments[0],
    jobTitle: segments[1],
    company: segments[2],
  };
}

/**
 * URL patterns that identify a result as something other than an individual's
 * profile page — a company/org page, a job posting or job board, a
 * recruitment agency, or an article. Matched against the result link before
 * it is ever turned into a candidate, so these never reach normalization,
 * dedupe, or matching.
 */
const NON_INDIVIDUAL_URL_PATTERNS: RegExp[] = [
  // LinkedIn pages that aren't a person's /in/ profile.
  /linkedin\.com\/(company|school|jobs|pulse|showcase|groups)\//i,
  // GitHub pages that aren't a user profile.
  /github\.com\/(orgs|about|sponsors|marketplace|topics|collections)\//i,
  // Generic job/career/vacancy paths on any domain.
  /\/(jobs?|careers?|vacanc(?:y|ies))(\/|$|\?)/i,
  // Known job boards and aggregators.
  /\b(indeed|glassdoor|bayt|wuzzuf|naukri|monster|ziprecruiter|simplyhired|careerjet|talent|dice|ycombinator)\.[a-z.]+\//i,
  // Known recruitment/staffing agencies.
  /\b(robertwalters|michaelpage|hays|randstad|adecco|kellyservices|roberthalf|manpower)\.[a-z.]+\//i,
];

function isIndividualProfileUrl(url: string): boolean {
  return !NON_INDIVIDUAL_URL_PATTERNS.some((pattern) => pattern.test(url));
}

function mapOrganicResult(result: SerpApiOrganicResult): CandidateSearchResult | null {
  if (!result.link) return null;
  if (!isIndividualProfileUrl(result.link)) return null;

  const { name, jobTitle, company } = parseTitleSegments(result.title);

  return {
    source: "serpapi",
    source_url: result.link,
    name,
    title: jobTitle,
    company,
    profile_url: result.link,
    snippet: result.snippet,
    skills: result.snippet_highlighted_words,
  };
}

export class SerpApiProvider implements SearchProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error(
        "SERPAPI_API_KEY is required to use SerpApiProvider. Set it in your environment.",
      );
    }
  }

  async searchCandidates(
    params: CandidateSearchParams,
  ): Promise<CandidateSearchResult[]> {
    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", params.query);
    url.searchParams.set("api_key", this.apiKey);
    if (params.location) {
      url.searchParams.set("location", params.location);
    }
    if (params.limit) {
      url.searchParams.set("num", String(params.limit));
    }
    if (params.page && params.page > 1 && params.limit) {
      url.searchParams.set("start", String((params.page - 1) * params.limit));
    }

    let data: SerpApiResponse;
    try {
      data = await withRetry(
        async () => {
          const response = await fetch(url.toString(), {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (!response.ok) {
            throw new SerpApiHttpError(response.status);
          }
          return (await response.json()) as SerpApiResponse;
        },
        {
          ...RETRY_OPTIONS,
          // A network-level failure (fetch itself throwing, e.g. DNS/timeout)
          // is just as transient as a 429/5xx, so it's retried too.
          isRetryable: (error) =>
            !(error instanceof SerpApiHttpError) || isRetryableStatus(error.status),
        },
      );
    } catch (error) {
      throw new SearchProviderError("serpapi", error);
    }

    if (data.error) {
      throw new SearchProviderError("serpapi", new Error(data.error));
    }

    return (data.organic_results ?? [])
      .map(mapOrganicResult)
      .filter((result): result is CandidateSearchResult => result !== null);
  }
}
