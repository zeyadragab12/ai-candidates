/**
 * Defensive validation layer applied to every candidate result — SerpApi
 * title-parsing and Apify LinkedIn enrichment both feed this — before it's
 * normalized or persisted. Never fabricates a replacement value: an
 * implausible field is dropped to null/undefined, exactly like any other
 * field this app couldn't determine, never guessed or substituted.
 */

// Our own recruiting company. A candidate's `company` field matching this is
// never a real employer for a sourced candidate — it's leaked/misattributed
// data (e.g. from a testing fixture, or a mis-keyed enrichment lookup; see
// ApifyLinkedInProvider's slug-keying fix). Kept as a normalized allowlist
// of known variants rather than a single literal string, since the same
// legal-entity-suffix and punctuation differences that affect dedupe
// matching (see dedupe.ts's normalizeCompanyForMatching) apply here too.
const OWN_COMPANY_NAME_VARIANTS = ["g developments", "the g developments"];

const COMPANY_SUFFIX_PATTERN =
  /\b(inc|incorporated|llc|ltd|limited|co|corp|corporation|gmbh|plc|group|holdings|company)\b\.?/gi;

function normalizeCompanyForComparison(value: string): string {
  const stripped = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "");
  const withoutSuffix = stripped.replace(COMPANY_SUFFIX_PATTERN, "").replace(/\s+/g, " ").trim();
  return withoutSuffix || stripped;
}

/**
 * True when a candidate's reported `company` is implausible: it matches
 * our own recruiting company, or the hiring job's own company name (when
 * known) — a sourced candidate's employer should never be either of those.
 */
export function isImplausibleCompany(
  company: string | null | undefined,
  jobCompanyName?: string | null,
): boolean {
  if (!company) return false;
  const normalized = normalizeCompanyForComparison(company);
  if (!normalized) return false;

  if (OWN_COMPANY_NAME_VARIANTS.includes(normalized)) return true;

  if (jobCompanyName) {
    const normalizedJobCompany = normalizeCompanyForComparison(jobCompanyName);
    if (normalizedJobCompany && normalized === normalizedJobCompany) return true;
  }

  return false;
}

// A generous upper bound on total career experience — anything beyond this
// is a parsing/scraping artifact (e.g. a mis-parsed date range), never a
// real candidate's tenure. Not used to "correct" a value, only to reject an
// implausible one back to null.
const MAX_PLAUSIBLE_EXPERIENCE_YEARS = 60;

export function isImplausibleExperienceYears(
  years: number | null | undefined,
): boolean {
  if (years === null || years === undefined) return false;
  return !Number.isFinite(years) || years < 0 || years > MAX_PLAUSIBLE_EXPERIENCE_YEARS;
}
