import { env } from "@/lib/env";
import { ApifyLinkedInProvider } from "@/lib/enrichment/ApifyLinkedInProvider";

let cachedProvider: ApifyLinkedInProvider | null | undefined;

/**
 * LinkedIn enrichment is optional, unlike the search provider: with neither
 * APIFY_API_TOKEN nor APIFY_ACTOR_ID set, this returns null and callers skip
 * the enrichment step entirely (SerpApi-only data flows straight to
 * OpenAI, same as before this feature existed). Setting only one of the two
 * is treated as a misconfiguration and throws — never silently falls back
 * to "no enrichment" once the feature has been opted into.
 */
export function getEnrichmentProvider(): ApifyLinkedInProvider | null {
  if (cachedProvider === undefined) {
    if (env.APIFY_API_TOKEN && env.APIFY_ACTOR_ID) {
      cachedProvider = new ApifyLinkedInProvider(env.APIFY_API_TOKEN, env.APIFY_ACTOR_ID);
    } else if (env.APIFY_API_TOKEN || env.APIFY_ACTOR_ID) {
      throw new Error(
        "LinkedIn enrichment requires both APIFY_API_TOKEN and APIFY_ACTOR_ID to be set; only one was found. Set both, or neither to disable enrichment.",
      );
    } else {
      cachedProvider = null;
    }
  }
  return cachedProvider;
}

export type { EnrichedLinkedInProfile } from "@/lib/enrichment/ApifyLinkedInProvider";
export { EnrichmentProviderError } from "@/lib/enrichment/ApifyLinkedInProvider";
