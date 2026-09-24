import { mentionsEgyptLocation } from "@/lib/candidates/egyptLocations";

// Non-geographic values a recruiter might reasonably type (or an AI
// extraction might return) into a job's location field that describe the
// *arrangement*, not a place — passing any of these straight to SerpApi's
// `location` geo-bias parameter is meaningless input, and observed to skew
// results toward wherever Google resolves the literal string to (often
// nothing useful, or an arbitrary place). None of these should ever bias a
// search.
const NON_GEOGRAPHIC_LOCATION_VALUES = [
  "remote",
  "fully remote",
  "remote global",
  "global",
  "worldwide",
  "anywhere",
  "n a",
  "na",
  "tbd",
  "flexible",
  "open",
];

/**
 * Whether a job's `location` value should be used to geographically bias a
 * candidate search (SerpApi's `location` param). False for empty values and
 * for non-geographic placeholders like "Remote" or "Global" — a role open
 * to candidates anywhere must not have its search results skewed toward
 * wherever that literal string happens to resolve to.
 */
export function shouldApplyLocationBias(location: string | null | undefined): boolean {
  if (!location) return false;
  const normalized = location
    .trim()
    .toLowerCase()
    .replace(/[.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return !NON_GEOGRAPHIC_LOCATION_VALUES.includes(normalized);
}

export interface SerpApiLocationParams {
  location?: string;
  countryCode?: string;
  googleDomain?: string;
}

/**
 * Resolves a job's location into SerpApi search params, with Egypt-specific
 * nationwide handling: a bare country-level value ("Egypt") searches at
 * country granularity (location="Egypt", gl="eg") instead of Google
 * resolving an arbitrary/narrow city, while a named governorate/city (e.g.
 * "Cairo, Egypt") keeps that specific location string but still gets
 * gl="eg" — that param does most of the actual work of biasing results
 * toward Egypt as a whole, whereas `location` alone is only a ranking hint.
 * Always a single set of params for the whole job, never looped per
 * governorate, so it doesn't multiply SerpApi usage or duplicate-candidate
 * risk across per-city searches.
 */
export function resolveEgyptSearchLocation(
  rawLocation: string | null | undefined,
): SerpApiLocationParams {
  if (!rawLocation || !shouldApplyLocationBias(rawLocation)) return {};

  const normalized = rawLocation.trim();
  const lower = normalized.toLowerCase();
  const isCountryLevel = lower === "egypt" || lower === "eg";

  if (!isCountryLevel && !mentionsEgyptLocation(normalized)) {
    return { location: normalized };
  }

  return {
    location: isCountryLevel ? "Egypt" : normalized,
    countryCode: "eg",
    googleDomain: "google.com.eg",
  };
}
