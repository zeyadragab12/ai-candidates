import { isRetryableStatus, withRetry } from "@/lib/retry";

const APIFY_API_BASE = "https://api.apify.com/v2";

// LinkedIn profile scrapes are far slower than a SerpApi search — Apify has
// to actually load and render each profile page. This ceiling is generous
// on purpose: a stalled run should fail (and be retried/logged) rather than
// hang the whole background search job forever.
const REQUEST_TIMEOUT_MS = 90000;

const RETRY_OPTIONS = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

// Cheapest tier the harvestapi/linkedin-profile-scraper actor offers ($4 per
// 1k profiles as of writing). We never need LinkedIn's email-search add-on
// ($10 per 1k) for matching, so we deliberately never request it.
const PROFILE_SCRAPER_MODE = "Profile details no email ($4 per 1k)";

export class EnrichmentProviderError extends Error {
  constructor(provider: string, cause?: unknown) {
    super(`Enrichment provider "${provider}" failed to return results.`);
    this.name = "EnrichmentProviderError";
    this.cause = cause;
  }
}

/** Marks the error with the HTTP status so withRetry's isRetryable can see it
 * without re-fetching or re-parsing the response. */
class ApifyHttpError extends Error {
  constructor(
    public readonly status: number,
    body?: string,
  ) {
    super(`Apify request failed with status ${status}${body ? `: ${body}` : ""}`);
  }
}

/**
 * Dataset item shape returned by the `harvestapi/linkedin-profile-scraper`
 * Apify Store actor (https://apify.com/harvestapi/linkedin-profile-scraper).
 * Only the fields this app consumes are declared here.
 */
interface HarvestApiLinkedInItem {
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  about?: string;
  location?: {
    linkedinText?: string;
  };
  currentPosition?: { companyName?: string }[];
  skills?: { name?: string }[];
  experience?: { duration?: string }[];
}

export interface EnrichedLinkedInProfile {
  profileUrl: string;
  name?: string;
  headline?: string;
  currentCompany?: string;
  location?: string;
  about?: string;
  skills?: string[];
  experienceYears?: number;
}

/**
 * Parses this actor's human-readable duration strings ("1 yr 7 mos", "3 mos",
 * "2 yrs") into a month count. Returns 0 for anything unparseable (e.g. "Less
 * than a year") rather than guessing — those entries simply don't contribute
 * to the tenure total below.
 */
function parseDurationMonths(duration: string | undefined): number {
  if (!duration) return 0;
  const years = Number(duration.match(/(\d+)\s*yr/)?.[1] ?? 0);
  const months = Number(duration.match(/(\d+)\s*mo/)?.[1] ?? 0);
  return years * 12 + months;
}

/**
 * Sums the actor's per-role duration strings into a single tenure estimate,
 * in whole years. Rounded rather than kept fractional because
 * candidates.experience_years is an integer column — confirmed against a
 * real insert (harvestapi returns "6.8"-style tenures for a full work
 * history, which a fractional value rejects with `invalid input syntax for
 * type integer`). Only produced when the actor actually returned structured
 * experience entries — never inferred from free text elsewhere, matching
 * this codebase's rule that candidate fields are set from real data or left
 * null, never guessed.
 */
function estimateExperienceYears(
  experience: HarvestApiLinkedInItem["experience"],
): number | undefined {
  if (!experience?.length) return undefined;
  const totalMonths = experience.reduce(
    (sum, role) => sum + parseDurationMonths(role.duration),
    0,
  );
  if (totalMonths <= 0) return undefined;
  return Math.round(totalMonths / 12);
}

function mapSkills(skills: HarvestApiLinkedInItem["skills"]): string[] | undefined {
  if (!skills?.length) return undefined;
  const names = skills
    .map((skill) => skill.name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names : undefined;
}

function mapItem(item: HarvestApiLinkedInItem): EnrichedLinkedInProfile | null {
  const profileUrl = item.linkedinUrl;
  if (!profileUrl) return null;

  const name = [item.firstName, item.lastName].filter(Boolean).join(" ").trim();

  return {
    profileUrl,
    name: name || undefined,
    headline: item.headline || undefined,
    currentCompany: item.currentPosition?.[0]?.companyName || undefined,
    location: item.location?.linkedinText || undefined,
    about: item.about || undefined,
    skills: mapSkills(item.skills),
    experienceYears: estimateExperienceYears(item.experience),
  };
}

/**
 * Enriches LinkedIn profile URLs (already discovered and filtered by
 * SerpApi) with real profile data via an Apify LinkedIn Profile Scraper
 * actor, run synchronously via Apify's "run-sync-get-dataset-items"
 * endpoint. Only takes the URLs SerpApi already found — Apify is never used
 * for discovery, only enrichment of candidates SerpApi already surfaced.
 */
export class ApifyLinkedInProvider {
  constructor(
    private readonly apiToken: string,
    private readonly actorId: string,
  ) {
    if (!apiToken) {
      throw new Error(
        "APIFY_API_TOKEN is required to use ApifyLinkedInProvider. Set it in your environment.",
      );
    }
    if (!actorId) {
      throw new Error(
        "APIFY_ACTOR_ID is required to use ApifyLinkedInProvider. Set it in your environment.",
      );
    }
  }

  /**
   * Returns a map keyed by the profile URL Apify was given, so callers can
   * merge enrichment results back onto the original candidate they came
   * from. URLs Apify couldn't resolve (private/removed profiles, etc.) are
   * simply absent from the map — never a fabricated empty entry.
   */
  async enrichProfiles(
    profileUrls: string[],
  ): Promise<Map<string, EnrichedLinkedInProfile>> {
    const result = new Map<string, EnrichedLinkedInProfile>();
    if (profileUrls.length === 0) return result;

    const url = new URL(
      `${APIFY_API_BASE}/acts/${encodeURIComponent(this.actorId)}/run-sync-get-dataset-items`,
    );
    url.searchParams.set("token", this.apiToken);

    let items: HarvestApiLinkedInItem[];
    try {
      items = await withRetry(
        async () => {
          const response = await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              queries: profileUrls,
              profileScraperMode: PROFILE_SCRAPER_MODE,
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (!response.ok) {
            throw new ApifyHttpError(response.status, await response.text());
          }
          return (await response.json()) as HarvestApiLinkedInItem[];
        },
        {
          ...RETRY_OPTIONS,
          // A network-level failure (fetch itself throwing, e.g. DNS/timeout)
          // is just as transient as a 429/5xx, so it's retried too.
          isRetryable: (error) =>
            !(error instanceof ApifyHttpError) || isRetryableStatus(error.status),
        },
      );
    } catch (error) {
      throw new EnrichmentProviderError("apify", error);
    }

    for (const item of items) {
      const mapped = mapItem(item);
      if (mapped) result.set(mapped.profileUrl, mapped);
    }

    return result;
  }
}
