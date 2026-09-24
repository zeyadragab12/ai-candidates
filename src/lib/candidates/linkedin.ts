/**
 * Extracts the `/in/<slug>` identifier LinkedIn uses to identify a profile,
 * regardless of protocol, country subdomain (SerpApi commonly returns
 * eg.linkedin.com, sa.linkedin.com, etc. for non-US profiles — confirmed
 * against real search results), trailing slash, or query string. Shared by
 * enrichment (src/lib/enrichment/ApifyLinkedInProvider.ts) and identity
 * matching (src/lib/candidates/dedupe.ts, persist.ts) so both use the exact
 * same notion of "same LinkedIn profile" — a www.linkedin.com/in/x URL and
 * an eg.linkedin.com/in/x/?trk=... URL are the same person for both
 * enrichment lookups and duplicate detection.
 */
export function extractLinkedInSlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : null;
}
