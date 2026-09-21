export interface CandidateForFiltering {
  id: string;
  name: string | null;
  company: string | null;
  location: string | null;
  experience_years: number | null;
  skills: string[];
  source: string;
  created_at: string;
  match: { match_score: number } | null;
}

export interface CandidateFilters {
  name?: string;
  skill?: string;
  location?: string;
  company?: string;
  source?: string;
  minExperience?: number;
  maxExperience?: number;
  minMatchScore?: number;
  maxMatchScore?: number;
}

export type CandidateSortField =
  | "name"
  | "experience_years"
  | "match_score"
  | "created_at";
export type SortDirection = "asc" | "desc";

function includesCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

/**
 * Applies every provided filter as an AND — a candidate must satisfy all
 * given criteria, not any one of them. Filters left undefined are ignored.
 */
export function filterCandidates<T extends CandidateForFiltering>(
  candidates: T[],
  filters: CandidateFilters,
): T[] {
  return candidates.filter((candidate) => {
    if (filters.name) {
      if (!candidate.name || !includesCaseInsensitive(candidate.name, filters.name)) {
        return false;
      }
    }

    if (filters.skill) {
      const hasSkill = candidate.skills.some((skill) =>
        includesCaseInsensitive(skill, filters.skill as string),
      );
      if (!hasSkill) return false;
    }

    if (filters.location) {
      if (
        !candidate.location ||
        !includesCaseInsensitive(candidate.location, filters.location)
      ) {
        return false;
      }
    }

    if (filters.company) {
      if (
        !candidate.company ||
        !includesCaseInsensitive(candidate.company, filters.company)
      ) {
        return false;
      }
    }

    if (filters.source) {
      if (candidate.source.toLowerCase() !== filters.source.toLowerCase()) {
        return false;
      }
    }

    if (filters.minExperience !== undefined) {
      if (
        candidate.experience_years === null ||
        candidate.experience_years < filters.minExperience
      ) {
        return false;
      }
    }

    if (filters.maxExperience !== undefined) {
      if (
        candidate.experience_years === null ||
        candidate.experience_years > filters.maxExperience
      ) {
        return false;
      }
    }

    if (filters.minMatchScore !== undefined) {
      if (!candidate.match || candidate.match.match_score < filters.minMatchScore) {
        return false;
      }
    }

    if (filters.maxMatchScore !== undefined) {
      if (!candidate.match || candidate.match.match_score > filters.maxMatchScore) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts without mutating the input array. Candidates missing the sort
 * field (null experience/match score) are always placed last, regardless
 * of sort direction, so an ascending sort doesn't put "unknown" ahead of
 * "known but low."
 */
export function sortCandidates<T extends CandidateForFiltering>(
  candidates: T[],
  field: CandidateSortField,
  direction: SortDirection,
): T[] {
  const factor = direction === "asc" ? 1 : -1;

  function getValue(candidate: T): string | number | null {
    switch (field) {
      case "name":
        return candidate.name;
      case "experience_years":
        return candidate.experience_years;
      case "match_score":
        return candidate.match?.match_score ?? null;
      case "created_at":
        return candidate.created_at;
    }
  }

  return [...candidates].sort((a, b) => {
    const valueA = getValue(a);
    const valueB = getValue(b);

    if (valueA === null && valueB === null) return 0;
    if (valueA === null) return 1;
    if (valueB === null) return -1;

    if (typeof valueA === "string" && typeof valueB === "string") {
      return factor * valueA.localeCompare(valueB);
    }
    return factor * ((valueA as number) - (valueB as number));
  });
}
