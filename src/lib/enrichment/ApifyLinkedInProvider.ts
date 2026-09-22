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

// A free-tier Apify account caps this actor at 10 dataset items PER RUN —
// confirmed live: a single run given 23 URLs returned one dataset item,
// `{"error": "Free users are limited to 10 items per run. Please upgrade to
// a paid plan to scrape more items."}`, instead of 23 results or an HTTP
// error. Splitting into multiple runs of <=10 URLs each keeps every run
// under that cap regardless of account tier (a paid account just processes
// each chunk normally).
const MAX_PROFILES_PER_RUN = 10;

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
  publicIdentifier?: string;
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

/**
 * Extracts the `/in/<slug>` identifier LinkedIn uses to identify a profile,
 * regardless of protocol, country subdomain (SerpApi commonly returns
 * eg.linkedin.com, sa.linkedin.com, etc. for non-US profiles — confirmed
 * against real search results), trailing slash, or query string. This is
 * the only reliable join key between a SerpApi result and Apify's dataset
 * item: Apify always canonicalizes linkedinUrl to www.linkedin.com, so
 * matching on the raw URL string silently drops every non-www result.
 */
export function extractLinkedInSlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : null;
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

/**
 * The actor doesn't always fail a run with a non-2xx status when something
 * goes wrong (e.g. exceeding the free-tier item cap) — it can return 201
 * with a single dataset item shaped like `{ error: "..." }` instead of
 * profile data. Detected by the presence of `error` and absence of the
 * fields every real profile item has, so a genuine failure is never mistaken
 * for "0 profiles found" and silently swallowed.
 */
interface HarvestApiErrorItem {
  error: string;
}

type HarvestApiDatasetItem = HarvestApiLinkedInItem | HarvestApiErrorItem;

function isErrorItem(item: HarvestApiDatasetItem): item is HarvestApiErrorItem {
  return typeof (item as HarvestApiErrorItem).error === "string" && !("linkedinUrl" in item);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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
   * Runs the actor once for a single chunk of <=MAX_PROFILES_PER_RUN URLs
   * and returns its raw dataset items.
   */
  private async runChunk(profileUrls: string[]): Promise<HarvestApiDatasetItem[]> {
    const url = new URL(
      `${APIFY_API_BASE}/acts/${encodeURIComponent(this.actorId)}/run-sync-get-dataset-items`,
    );
    url.searchParams.set("token", this.apiToken);

    return withRetry(
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
        return (await response.json()) as HarvestApiDatasetItem[];
      },
      {
        ...RETRY_OPTIONS,
        // A network-level failure (fetch itself throwing, e.g. DNS/timeout)
        // is just as transient as a 429/5xx, so it's retried too.
        isRetryable: (error) =>
          !(error instanceof ApifyHttpError) || isRetryableStatus(error.status),
      },
    );
  }

  /**
   * Returns a map keyed by extractLinkedInSlug() of each profile URL (NOT
   * the raw URL string — see extractLinkedInSlug's doc comment), so callers
   * can merge enrichment results back onto the original candidate by
   * running the same slug extraction over their own URL. URLs Apify
   * couldn't resolve (private/removed profiles, etc.) are simply absent
   * from the map — never a fabricated empty entry.
   *
   * Requests are split into chunks of at most MAX_PROFILES_PER_RUN (one
   * actor run each, sequentially — not parallel, to stay well under Apify's
   * concurrency limits on a free-tier account). One chunk failing (network
   * error, or the actor returning its `{error: "..."}` item shape) doesn't
   * abort the others; it's only surfaced as a thrown EnrichmentProviderError
   * if EVERY chunk failed and nothing was enriched at all, so a single bad
   * chunk degrades gracefully instead of losing an entire batch's real data.
   */
  async enrichProfiles(
    profileUrls: string[],
  ): Promise<Map<string, EnrichedLinkedInProfile>> {
    const result = new Map<string, EnrichedLinkedInProfile>();
    if (profileUrls.length === 0) return result;

    let lastError: unknown;

    for (const urlChunk of chunk(profileUrls, MAX_PROFILES_PER_RUN)) {
      let items: HarvestApiDatasetItem[];
      try {
        items = await this.runChunk(urlChunk);
      } catch (error) {
        lastError = error;
        continue;
      }

      for (const item of items) {
        if (isErrorItem(item)) {
          lastError = new Error(item.error);
          continue;
        }
        const mapped = mapItem(item);
        if (!mapped) continue;
        const key = item.publicIdentifier?.toLowerCase() || extractLinkedInSlug(mapped.profileUrl);
        if (key) result.set(key, mapped);
      }
    }

    if (result.size === 0 && lastError) {
      throw new EnrichmentProviderError("apify", lastError);
    }

    return result;
  }
}
