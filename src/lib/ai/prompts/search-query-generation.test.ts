import { describe, expect, it } from "vitest";

import {
  buildSearchQueryGenerationPrompt,
  searchQueryGenerationSchema,
} from "./search-query-generation";
import type { JobAnalysis } from "@/types/job-analysis";

function makeAnalysis(overrides: Partial<JobAnalysis> = {}): JobAnalysis {
  return {
    job_title: "Frontend React Developer",
    seniority: "Mid",
    location: "Cairo, Egypt",
    employment_type: "Full-time",
    required_skills: ["React", "TypeScript", "Next.js"],
    preferred_skills: [],
    years_of_experience: { minimum: 3, maximum: null },
    education: [],
    certifications: [],
    languages: [],
    industries: [],
    keywords: [],
    responsibilities: [],
    search_keywords: [],
    search_queries: [],
    ...overrides,
  };
}

describe("searchQueryGenerationSchema", () => {
  it("accepts 2 to 4 non-empty query strings", () => {
    expect(
      searchQueryGenerationSchema.safeParse({
        search_queries: ["React Developer Cairo", "React TypeScript Egypt"],
      }).success,
    ).toBe(true);

    expect(
      searchQueryGenerationSchema.safeParse({
        search_queries: ["a", "b", "c", "d"],
      }).success,
    ).toBe(true);
  });

  it("rejects fewer than 2 queries", () => {
    expect(
      searchQueryGenerationSchema.safeParse({ search_queries: ["only one"] })
        .success,
    ).toBe(false);
  });

  it("rejects more than 4 queries", () => {
    expect(
      searchQueryGenerationSchema.safeParse({
        search_queries: ["a", "b", "c", "d", "e"],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty string as a query", () => {
    expect(
      searchQueryGenerationSchema.safeParse({ search_queries: ["a", ""] })
        .success,
    ).toBe(false);
  });

  it("rejects search_queries as a non-array", () => {
    expect(
      searchQueryGenerationSchema.safeParse({
        search_queries: "React Developer Cairo",
      }).success,
    ).toBe(false);
  });
});

describe("buildSearchQueryGenerationPrompt", () => {
  it("includes the job title, skills, and location in the prompt", () => {
    const prompt = buildSearchQueryGenerationPrompt(makeAnalysis());
    expect(prompt).toContain("Frontend React Developer");
    expect(prompt).toContain("React, TypeScript, Next.js");
    expect(prompt).toContain("Cairo, Egypt");
  });

  it("handles missing location/seniority without crashing", () => {
    const prompt = buildSearchQueryGenerationPrompt(
      makeAnalysis({ location: "", seniority: "" }),
    );
    expect(prompt).toContain("(not specified)");
  });
});
