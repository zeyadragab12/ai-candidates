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
