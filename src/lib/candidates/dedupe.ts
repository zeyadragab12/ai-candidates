import type { NormalizedCandidate } from "@/types/candidate";

function normalizeForMatching(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

/**
 * The same identity logic dedupeCandidates() uses internally, exposed for
 * callers (e.g. persistence) that need to match a candidate against
 * existing records using the identical rules. Returns null when there's no
 * reliable identity signal.
 */
export function getCandidateIdentityKey(
  candidate: NormalizedCandidate,
): string | null {
  if (candidate.profile_url) {
    return `url:${normalizeUrl(candidate.profile_url)}`;
  }
  if (candidate.name && candidate.current_company) {
    return `name-company:${normalizeForMatching(candidate.name)}|${normalizeForMatching(candidate.current_company)}`;
  }
  return null;
}

function mergeCandidate(
  existing: NormalizedCandidate,
  incoming: NormalizedCandidate,
): NormalizedCandidate {
  return {
    name: existing.name ?? incoming.name,
    headline: existing.headline ?? incoming.headline,
    current_company: existing.current_company ?? incoming.current_company,
    location: existing.location ?? incoming.location,
    profile_url: existing.profile_url ?? incoming.profile_url,
    profile_image_url: existing.profile_image_url ?? incoming.profile_image_url,
    source: existing.source,
    source_url: existing.source_url,
    summary: existing.summary ?? incoming.summary,
    skills: Array.from(new Set([...existing.skills, ...incoming.skills])),
    experience_years: existing.experience_years ?? incoming.experience_years,
  };
}

/**
 * Deduplicates candidates using, in priority order:
 *   1. profile_url (most reliable signal, when available)
 *   2. normalized name + company (only when no profile_url is available)
 *
 * A candidate with a profile_url is NEVER matched via name+company — mixing
 * the two keyspaces risks merging two distinct real people who happen to
 * share a name and employer. When neither signal is available, the
 * candidate is always kept as its own unique entry: merging two different
 * people into one record is treated as a strictly worse bug than failing
 * to catch a duplicate.
 */
export function dedupeCandidates(
  candidates: NormalizedCandidate[],
): NormalizedCandidate[] {
  const byIdentityKey = new Map<string, NormalizedCandidate>();
  const result: NormalizedCandidate[] = [];

  for (const candidate of candidates) {
    const key = getCandidateIdentityKey(candidate);

    if (!key) {
      result.push(candidate);
      continue;
    }

    const existing = byIdentityKey.get(key);
    if (existing) {
      const merged = mergeCandidate(existing, candidate);
      byIdentityKey.set(key, merged);
      const index = result.indexOf(existing);
      if (index !== -1) result[index] = merged;
    } else {
      byIdentityKey.set(key, candidate);
      result.push(candidate);
    }
  }

  return result;
}
