import type { SupabaseClient } from "@supabase/supabase-js";

import { getCandidateIdentityKey, normalizeCompanyForMatching } from "@/lib/candidates/dedupe";
import { extractLinkedInSlug } from "@/lib/candidates/linkedin";
import type { NormalizedCandidate } from "@/types/candidate";

/** Escapes Postgres ILIKE wildcard characters so a slug/name with a literal
 * `%` or `_` is matched literally rather than as a pattern. */
function escapeIlikePattern(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

const UNIQUE_VIOLATION = "23505";

interface CandidateRow {
  id: string;
}

interface ExistingCandidateRow extends CandidateRow {
  headline: string | null;
  company: string | null;
  location: string | null;
  summary: string | null;
  skills: string[] | null;
  experience_years: number | null;
  profile_image_url: string | null;
  location_verified: boolean | null;
}

/**
 * Diffs a freshly-found candidate against the row already on file for the
 * same identity and returns only the fields worth writing back: scalars
 * that are currently null (never clobbers a value already on record, e.g.
 * one a recruiter may have edited) and skills, which are unioned rather
 * than replaced so a later search that finds fewer/different highlighted
 * words never loses skills an earlier search already captured.
 */
function buildEnrichmentUpdate(
  existing: ExistingCandidateRow,
  incoming: NormalizedCandidate,
): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (existing.headline === null && incoming.headline !== null) {
    update.headline = incoming.headline;
  }
  if (existing.company === null && incoming.current_company !== null) {
    update.company = incoming.current_company;
  }
  if (existing.location === null && incoming.location !== null) {
    update.location = incoming.location;
  }
  if (existing.summary === null && incoming.summary !== null) {
    update.summary = incoming.summary;
  }
  if (existing.experience_years === null && incoming.experience_years !== null) {
    update.experience_years = incoming.experience_years;
  }
  if (existing.profile_image_url === null && incoming.profile_image_url !== null) {
    update.profile_image_url = incoming.profile_image_url;
  }
  if (existing.location_verified === null && incoming.location_verified != null) {
    update.location_verified = incoming.location_verified;
  }

  const mergedSkills = Array.from(
    new Set([...(existing.skills ?? []), ...incoming.skills]),
  );
  if (mergedSkills.length !== (existing.skills ?? []).length) {
    update.skills = mergedSkills;
  }

  return update;
}

function toRow(candidate: NormalizedCandidate, userId: string, rawData: unknown) {
  return {
    user_id: userId,
    name: candidate.name?.trim() ?? null,
    headline: candidate.headline,
    company: candidate.current_company?.trim() ?? null,
    location: candidate.location,
    profile_url: candidate.profile_url,
    profile_image_url: candidate.profile_image_url,
    source: candidate.source,
    source_url: candidate.source_url,
    summary: candidate.summary,
    skills: candidate.skills,
    experience_years: candidate.experience_years,
    raw_data: rawData ?? null,
    location_verified: candidate.location_verified ?? null,
  };
}

const EXISTING_CANDIDATE_COLUMNS =
  "id, headline, company, location, summary, skills, experience_years, profile_image_url, location_verified";

/**
 * Finds a previously persisted candidate matching this identity, across
 * every earlier search run and job for this user — not just the run
 * currently being processed. persistCandidates() is the single choke point
 * every search run's results pass through, and it's never scoped to a
 * job_id or run_id, so this lookup is inherently cross-run and cross-job
 * already; the identity rules below just make it catch more real
 * duplicates within that same scope.
 */
async function findExisting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  candidate: NormalizedCandidate,
): Promise<ExistingCandidateRow | null> {
  if (candidate.profile_url) {
    const linkedInSlug = extractLinkedInSlug(candidate.profile_url);

    // A LinkedIn profile is matched by its /in/<slug> identifier rather
    // than the literal URL, so a candidate persisted from one search run's
    // www.linkedin.com/in/x and re-found by a later run as
    // eg.linkedin.com/in/x/?trk=y resolve to the same existing row instead
    // of a duplicate insert.
    const query = linkedInSlug
      ? supabase
          .from("candidates")
          .select(EXISTING_CANDIDATE_COLUMNS)
          .eq("user_id", userId)
          .ilike("profile_url", `%/in/${escapeIlikePattern(linkedInSlug)}%`)
      : supabase
          .from("candidates")
          .select(EXISTING_CANDIDATE_COLUMNS)
          .eq("user_id", userId)
          .eq("profile_url", candidate.profile_url);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  if (candidate.name && candidate.current_company) {
    // Fetched by name alone (name has no reliable suffix/variant issue the
    // way company legal-entity names do), then filtered in JS by
    // normalizeCompanyForMatching so "Acme Inc." and "Acme" resolve to the
    // same existing row — a plain DB-level ilike can't express that
    // suffix-stripping rule.
    const { data, error } = await supabase
      .from("candidates")
      .select(`${EXISTING_CANDIDATE_COLUMNS}, name`)
      .eq("user_id", userId)
      .is("profile_url", null)
      .ilike("name", candidate.name.trim());
    if (error) throw error;

    const targetCompany = normalizeCompanyForMatching(candidate.current_company);
    const rows = (data ?? []) as (ExistingCandidateRow & { name: string | null })[];
    return (
      rows.find(
        (row) => row.company && normalizeCompanyForMatching(row.company) === targetCompany,
      ) ?? null
    );
  }

  return null;
}

export interface PersistedCandidate {
  id: string;
  isNew: boolean;
}

/**
 * Persists normalized, deduped candidates for a user, idempotently: a
 * candidate that already exists (matched by profile_url, or by name+company
 * when no profile_url is available) is left as-is rather than duplicated.
 * Re-running a search with identical results must not create new rows.
 *
 * Deliberate exception: a candidate with NEITHER a profile_url NOR a
 * name+company pair has no reliable identity signal at all, so it is always
 * inserted as new (matching dedupeCandidates' own behavior). Re-running a
 * search containing such a candidate will therefore create a duplicate row
 * every time. This is an accepted trade-off, not a bug — in this
 * ultra-sparse case, matching it against an existing row would mean
 * guessing that it's the same person with zero actual evidence, and a
 * false-positive merge of two different people is treated as strictly
 * worse than a duplicate row. In practice, real search providers almost
 * always return at least a name; this mainly surfaces with pathological
 * inputs like MockSearchProvider's deliberately bare fixture.
 */
export async function persistCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  candidates: NormalizedCandidate[],
  rawDataByCandidate?: Map<NormalizedCandidate, unknown>,
): Promise<PersistedCandidate[]> {
  const results: PersistedCandidate[] = [];

  for (const candidate of candidates) {
    const rawData = rawDataByCandidate?.get(candidate) ?? null;
    const key = getCandidateIdentityKey(candidate);

    if (key) {
      const existing = await findExisting(supabase, userId, candidate);
      if (existing) {
        const enrichment = buildEnrichmentUpdate(existing, candidate);
        if (Object.keys(enrichment).length > 0) {
          const { error: updateError } = await supabase
            .from("candidates")
            .update(enrichment)
            .eq("id", existing.id);
          if (updateError) throw updateError;
        }
        results.push({ id: existing.id, isNew: false });
        continue;
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("candidates")
      .insert(toRow(candidate, userId, rawData))
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === UNIQUE_VIOLATION) {
        const raceExisting = await findExisting(supabase, userId, candidate);
        if (raceExisting) {
          results.push({ id: raceExisting.id, isNew: false });
          continue;
        }
      }
      throw insertError;
    }

    results.push({ id: (inserted as CandidateRow).id, isNew: true });
  }

  return results;
}
