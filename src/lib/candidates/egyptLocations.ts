/**
 * Egypt's 27 governorates plus generic country identifiers, used to
 * recognize an Egypt-based candidate/location from free text. Shared
 * between SerpApi location-param resolution (nationwide vs. city-specific
 * targeting, see locationBias.ts) and the post-search location
 * verification filter, so both stay in sync with the same list.
 */
export const EGYPT_GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Qalyubia",
  "Port Said",
  "Suez",
  "Dakahlia",
  "Sharqia",
  "Gharbia",
  "Monufia",
  "Beheira",
  "Kafr El Sheikh",
  "Damietta",
  "Ismailia",
  "Faiyum",
  "Beni Suef",
  "Minya",
  "Asyut",
  "Sohag",
  "Qena",
  "Luxor",
  "Aswan",
  "Red Sea",
  "New Valley",
  "Matrouh",
  "North Sinai",
  "South Sinai",
] as const;

const EGYPT_LOCATION_TERMS = [
  "egypt",
  "eg",
  ...EGYPT_GOVERNORATES.map((governorate) => governorate.toLowerCase()),
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `text` contains an explicit mention of Egypt or one of its
 * governorates, matched as a whole word/phrase rather than a substring
 * buried inside an unrelated word. Deliberately simple word-boundary
 * matching, not fuzzy — a false negative here just falls through to the AI
 * verification tier (see verifyEgyptLocation.ts) rather than wrongly
 * excluding someone, so erring toward stricter matching here is safe.
 */
export function mentionsEgyptLocation(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EGYPT_LOCATION_TERMS.some((term) =>
    new RegExp(`\\b${escapeRegExp(term)}\\b`).test(lower),
  );
}
