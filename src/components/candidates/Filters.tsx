"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CandidateSortField,
  SortDirection,
} from "@/lib/candidates/filterAndSort";

export interface CandidateFilterState {
  name: string;
  skill: string;
  location: string;
  company: string;
  source: string;
  minExperience: string;
  maxExperience: string;
  minMatchScore: string;
  maxMatchScore: string;
  sortBy: CandidateSortField;
  sortDir: SortDirection;
}

export const DEFAULT_CANDIDATE_FILTERS: CandidateFilterState = {
  name: "",
  skill: "",
  location: "",
  company: "",
  source: "",
  minExperience: "",
  maxExperience: "",
  minMatchScore: "",
  maxMatchScore: "",
  sortBy: "match_score",
  sortDir: "desc",
};

const SORT_OPTIONS: { value: CandidateSortField; label: string }[] = [
  { value: "match_score", label: "Match Score" },
  { value: "experience_years", label: "Experience" },
  { value: "name", label: "Name" },
  { value: "created_at", label: "Date Added" },
];

interface FiltersProps {
  value: CandidateFilterState;
  onChange: (value: CandidateFilterState) => void;
}

export function Filters({ value, onChange }: FiltersProps) {
  const [draft, setDraft] = useState(value);

  function updateDraft<K extends keyof CandidateFilterState>(
    key: K,
    fieldValue: CandidateFilterState[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: fieldValue }));
  }

  function applyFilters() {
    onChange(draft);
  }

  function clearFilters() {
    const cleared = { ...DEFAULT_CANDIDATE_FILTERS, sortBy: value.sortBy, sortDir: value.sortDir };
    setDraft(cleared);
    onChange(cleared);
  }

  function updateSort(sortBy: CandidateSortField) {
    const updated = { ...draft, sortBy };
    setDraft(updated);
    onChange(updated);
  }

  function toggleSortDir() {
    const updated: CandidateFilterState = {
      ...draft,
      sortDir: draft.sortDir === "asc" ? "desc" : "asc",
    };
    setDraft(updated);
    onChange(updated);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="candidate-filters">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search by name"
          value={draft.name}
          onChange={(e) => updateDraft("name", e.target.value)}
          data-testid="filter-name"
        />
        <Input
          placeholder="Search by skill"
          value={draft.skill}
          onChange={(e) => updateDraft("skill", e.target.value)}
          data-testid="filter-skill"
        />
        <Input
          placeholder="Location"
          value={draft.location}
          onChange={(e) => updateDraft("location", e.target.value)}
          data-testid="filter-location"
        />
        <Input
          placeholder="Company"
          value={draft.company}
          onChange={(e) => updateDraft("company", e.target.value)}
          data-testid="filter-company"
        />
        <Input
          placeholder="Source"
          value={draft.source}
          onChange={(e) => updateDraft("source", e.target.value)}
          data-testid="filter-source"
        />
        <Input
          type="number"
          placeholder="Min experience (yrs)"
          value={draft.minExperience}
          onChange={(e) => updateDraft("minExperience", e.target.value)}
          data-testid="filter-min-experience"
        />
        <Input
          type="number"
          placeholder="Max experience (yrs)"
          value={draft.maxExperience}
          onChange={(e) => updateDraft("maxExperience", e.target.value)}
          data-testid="filter-max-experience"
        />
        <Input
          type="number"
          placeholder="Min match score"
          value={draft.minMatchScore}
          onChange={(e) => updateDraft("minMatchScore", e.target.value)}
          data-testid="filter-min-match-score"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={applyFilters} data-testid="filter-apply">
          Apply Filters
        </Button>
        <Button type="button" variant="outline" onClick={clearFilters} data-testid="filter-clear">
          Clear
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by</span>
          <Select value={draft.sortBy} onValueChange={(v) => updateSort(v as CandidateSortField)}>
            <SelectTrigger className="w-[160px]" data-testid="filter-sort-field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={toggleSortDir}
            data-testid="filter-sort-direction"
          >
            {draft.sortDir === "desc" ? "High → Low" : "Low → High"}
          </Button>
        </div>
      </div>
    </div>
  );
}
