import { extractLinkedInSlug } from "@/lib/candidates/linkedin";
import type { NormalizedCandidate } from "@/types/candidate";

// Legal-entity suffixes that don't change who the employer actually is
// ("Acme Inc." and "Acme Inc" and "Acme" are the same company for identity
// purposes). Stripped before comparing, never stored or displayed — this
// only affects matching, not any field written to the candidate record.
const COMPANY_SUFFIX_PATTERN =
  /\b(inc|incorporated|llc|ltd|limited|co|corp|corporation|gmbh|plc|group|holdings|company)\b\.?/gi;

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizeForMatching(value: string): string {
  return stripDiacritics(value)
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Normalizes a company name for identity matching: strips diacritics,
 * punctuation, and common legal-entity suffixes so "Acme Inc.", "ACME
 * INC", and "Acme" are recognized as the same employer. This widens exact
 * matching (still no fuzzy/edit-distance guessing — a typo'd company name
 * still won't match), keeping the false-positive-merge risk unchanged.
 * Exported so persist.ts's DB-level lookup uses the identical rule.
 */
export function normalizeCompanyForMatching(value: string): string {
  const withoutSuffix = normalizeForMatching(value).replace(COMPANY_SUFFIX_PATTERN, "");
  return withoutSuffix.replace(/\s+/g, " ").trim() || normalizeForMatching(value);
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
 *
 * A LinkedIn profile_url is matched by its `/in/<slug>` identifier (see
 * extractLinkedInSlug), not the raw URL string — a candidate found via
 * www.linkedin.com/in/x in one search run and eg.linkedin.com/in/x/?trk=y
 * in another (SerpApi returns different country subdomains for the same
 * profile) is the same person and must resolve to the same identity key.
 * Any other profile_url (GitHub, a company career site, etc.) falls back to
 * generic URL normalization, since there's no equivalent slug convention
 * to rely on there.
 */
export function getCandidateIdentityKey(
  candidate: NormalizedCandidate,
): string | null {
  if (candidate.profile_url) {
    const linkedInSlug = extractLinkedInSlug(candidate.profile_url);
    if (linkedInSlug) {
      return `linkedin:${linkedInSlug}`;
    }
    return `url:${normalizeUrl(candidate.profile_url)}`;
  }
  if (candidate.name && candidate.current_company) {
    return `name-company:${normalizeForMatching(candidate.name)}|${normalizeCompanyForMatching(candidate.current_company)}`;
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
    location_verified: existing.location_verified ?? incoming.location_verified ?? null,
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
