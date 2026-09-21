import type { SupabaseClient } from "@supabase/supabase-js";

import { getCandidateIdentityKey } from "@/lib/candidates/dedupe";
import type { NormalizedCandidate } from "@/types/candidate";

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
    source: candidate.source,
    source_url: candidate.source_url,
    summary: candidate.summary,
    skills: candidate.skills,
    experience_years: candidate.experience_years,
    raw_data: rawData ?? null,
  };
}

async function findExisting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  candidate: NormalizedCandidate,
): Promise<ExistingCandidateRow | null> {
  let query = supabase
    .from("candidates")
    .select("id, headline, company, location, summary, skills, experience_years")
    .eq("user_id", userId);

  if (candidate.profile_url) {
    query = query.eq("profile_url", candidate.profile_url);
  } else if (candidate.name && candidate.current_company) {
    query = query
      .is("profile_url", null)
      .ilike("name", candidate.name.trim())
      .ilike("company", candidate.current_company.trim());
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
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
