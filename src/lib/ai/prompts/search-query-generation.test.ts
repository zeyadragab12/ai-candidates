import { describe, expect, it, vi } from "vitest";

import {
  buildSearchQueryGenerationPrompt,
  generateSearchQueries,
  searchQueryGenerationSchema,
} from "./search-query-generation";
import type { AIProvider } from "@/lib/ai/AIProvider";
import type { JobAnalysis } from "@/types/job-analysis";

function makeAnalysis(overrides: Partial<JobAnalysis> = {}): JobAnalysis {
  return {
    job_title: "Frontend React Developer",
    seniority: "Mid",
    location: "Egypt",
    country: "Cairo",
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
    expect(prompt).toContain("Location: Egypt");
  });

  it("handles missing location/seniority without crashing", () => {
    const prompt = buildSearchQueryGenerationPrompt(
      makeAnalysis({ location: "", seniority: "" }),
    );
    expect(prompt).toContain("(not specified)");
  });

  it("shows '(none yet)' with no previous queries, and lists them when given", () => {
    expect(buildSearchQueryGenerationPrompt(makeAnalysis())).toContain("(none yet)");

    const prompt = buildSearchQueryGenerationPrompt(makeAnalysis(), [
      "query one",
      "query two",
    ]);
    expect(prompt).toContain("- query one");
    expect(prompt).toContain("- query two");
    expect(prompt).not.toContain("(none yet)");
  });
});

describe("generateSearchQueries", () => {
  function makeProvider(...responses: string[][]): AIProvider {
    const generateText = vi.fn();
    for (const queries of responses) {
      generateText.mockResolvedValueOnce(JSON.stringify({ search_queries: queries }));
    }
    return { generateText };
  }

  it("returns the AI's queries unchanged when there's no history and no duplicates", async () => {
    const provider = makeProvider(["query one", "query two"]);

    const result = await generateSearchQueries(makeAnalysis(), provider);

    expect(result).toEqual(["query one", "query two"]);
    expect(provider.generateText).toHaveBeenCalledTimes(1);
  });

  it("drops a query that duplicates history and retries to backfill it", async () => {
    const provider = makeProvider(
      ["old query", "new query a"], // "old query" collides with history, leaving only 1 accepted
      ["new query b", "new query c"], // retry runs because 1 < 2; both are accepted
    );

    const result = await generateSearchQueries(makeAnalysis(), provider, ["Old Query"]);

    expect(result).not.toContain("old query");
    expect(result).toEqual(["new query a", "new query b", "new query c"]);
    expect(provider.generateText).toHaveBeenCalledTimes(2);
  });

  it("matches duplicates case-insensitively and ignoring extra whitespace", async () => {
    const provider = makeProvider(
      ["  Old   Query  ", "new query a"], // normalizes to "old query", collides with history
      ["new query b", "new query c"],
    );

    const result = await generateSearchQueries(makeAnalysis(), provider, ["old query"]);

    expect(result).toEqual(["new query a", "new query b", "new query c"]);
  });

  it("falls back to the last raw response if every attempt collides with history", async () => {
    const provider = makeProvider(
      ["old query", "another old query"],
      ["old query", "another old query"],
      ["old query", "another old query"],
    );

    const result = await generateSearchQueries(makeAnalysis(), provider, [
      "old query",
      "another old query",
    ]);

    expect(result).toEqual(["old query", "another old query"]);
    expect(provider.generateText).toHaveBeenCalledTimes(3);
  });

  it("passes the previous queries through to the prompt sent to the provider", async () => {
    const provider = makeProvider(["new query a", "new query b"]);

    await generateSearchQueries(makeAnalysis(), provider, ["history query"]);

    const [prompt] = (provider.generateText as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
    ];
    expect(prompt).toContain("history query");
  });
});
