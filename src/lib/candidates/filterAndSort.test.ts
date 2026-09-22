import { describe, expect, it } from "vitest";

import { filterCandidates, sortCandidates, type CandidateForFiltering } from "./filterAndSort";

function makeCandidate(
  overrides: Partial<CandidateForFiltering> = {},
): CandidateForFiltering {
  return {
    id: "id",
    name: "Amina Hassan",
    company: "Nile Software",
    location: "Cairo, Egypt",
    experience_years: 5,
    skills: ["React", "TypeScript"],
    source: "mock",
    status: "New",
    created_at: "2026-01-01T00:00:00Z",
    match: { match_score: 80 },
    ...overrides,
  };
}

describe("filterCandidates", () => {
  it("filters by name (case-insensitive, partial)", () => {
    const candidates = [makeCandidate({ name: "Amina Hassan" }), makeCandidate({ name: "Omar" })];
    const result = filterCandidates(candidates, { name: "amina" });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Amina Hassan");
  });

  it("filters by skill (case-insensitive, partial)", () => {
    const candidates = [
      makeCandidate({ skills: ["React", "TypeScript"] }),
      makeCandidate({ skills: ["Vue"] }),
    ];
    const result = filterCandidates(candidates, { skill: "react" });
    expect(result).toHaveLength(1);
  });

  it("filters by location and company", () => {
    const candidates = [
      makeCandidate({ location: "Cairo, Egypt", company: "Acme" }),
      makeCandidate({ location: "Giza, Egypt", company: "Acme" }),
    ];
    expect(filterCandidates(candidates, { location: "cairo" })).toHaveLength(1);
    expect(filterCandidates(candidates, { company: "acme" })).toHaveLength(2);
  });

  it("filters by status (case-insensitive, exact match)", () => {
    const candidates = [
      makeCandidate({ status: "New" }),
      makeCandidate({ status: "Shortlisted" }),
    ];
    expect(filterCandidates(candidates, { status: "new" })).toHaveLength(1);
    expect(filterCandidates(candidates, { status: "Shortlisted" })).toHaveLength(1);
    expect(filterCandidates(candidates, { status: "Rejected" })).toHaveLength(0);
  });

  it("combines multiple filters as AND, not overriding each other", () => {
    const candidates = [
      makeCandidate({ name: "Amina Hassan", location: "Cairo, Egypt", status: "New" }),
      makeCandidate({ name: "Amina Hassan", location: "Giza, Egypt", status: "New" }),
      makeCandidate({ name: "Omar", location: "Cairo, Egypt", status: "New" }),
      makeCandidate({ name: "Amina Hassan", location: "Cairo, Egypt", status: "Rejected" }),
    ];
    // Only the first candidate satisfies ALL three filters at once.
    const result = filterCandidates(candidates, {
      name: "amina",
      location: "cairo",
      status: "New",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(candidates[0]);
  });

  it("returns everything when no filters are provided", () => {
    const candidates = [makeCandidate(), makeCandidate({ name: "Omar" })];
    expect(filterCandidates(candidates, {})).toHaveLength(2);
  });
});

describe("sortCandidates", () => {
  it("sorts by match_score descending and ascending", () => {
    const candidates = [
      makeCandidate({ id: "a", match: { match_score: 50 } }),
      makeCandidate({ id: "b", match: { match_score: 90 } }),
      makeCandidate({ id: "c", match: { match_score: 70 } }),
    ];
    expect(sortCandidates(candidates, "match_score", "desc").map((c) => c.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortCandidates(candidates, "match_score", "asc").map((c) => c.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("sorts by experience", () => {
    const candidates = [
      makeCandidate({ id: "a", experience_years: 2 }),
      makeCandidate({ id: "b", experience_years: 8 }),
    ];
    expect(sortCandidates(candidates, "experience_years", "asc").map((c) => c.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("sorts by name alphabetically", () => {
    const candidates = [
      makeCandidate({ id: "a", name: "Zaid" }),
      makeCandidate({ id: "b", name: "Amina" }),
    ];
    expect(sortCandidates(candidates, "name", "asc").map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("sorts by date added", () => {
    const candidates = [
      makeCandidate({ id: "a", created_at: "2026-02-01T00:00:00Z" }),
      makeCandidate({ id: "b", created_at: "2026-01-01T00:00:00Z" }),
    ];
    expect(sortCandidates(candidates, "created_at", "desc").map((c) => c.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("always places candidates with a null sort value last, regardless of direction", () => {
    const candidates = [
      makeCandidate({ id: "a", match: { match_score: 60 } }),
      makeCandidate({ id: "b", match: null }),
      makeCandidate({ id: "c", match: { match_score: 30 } }),
    ];
    expect(sortCandidates(candidates, "match_score", "asc").at(-1)?.id).toBe("b");
    expect(sortCandidates(candidates, "match_score", "desc").at(-1)?.id).toBe("b");
  });

  it("does not mutate the input array", () => {
    const candidates = [makeCandidate({ id: "a" }), makeCandidate({ id: "b" })];
    const original = [...candidates];
    sortCandidates(candidates, "name", "desc");
    expect(candidates).toEqual(original);
  });
});
