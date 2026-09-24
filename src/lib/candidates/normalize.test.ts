import { describe, expect, it } from "vitest";

import { normalizeCandidate } from "./normalize";
import { MockSearchProvider } from "@/lib/search/MockSearchProvider";
import { normalizedCandidateSchema } from "@/types/candidate";

describe("normalizeCandidate", () => {
  it("maps a fully populated result without loss", () => {
    const normalized = normalizeCandidate({
      source: "mock",
      source_url: "https://example.com/search?q=x",
      name: "Amina Hassan",
      title: "Senior React Developer",
      company: "Nile Software Solutions",
      location: "Cairo, Egypt",
      profile_url: "https://example.com/in/amina-hassan",
      snippet: "5+ years building React and TypeScript applications.",
      skills: ["React", "TypeScript", "Next.js"],
    });

    expect(normalized).toEqual({
      name: "Amina Hassan",
      headline: "Senior React Developer",
      current_company: "Nile Software Solutions",
      location: "Cairo, Egypt",
      profile_url: "https://example.com/in/amina-hassan",
      profile_image_url: null,
      source: "mock",
      source_url: "https://example.com/search?q=x",
      summary: "5+ years building React and TypeScript applications.",
      skills: ["React", "TypeScript", "Next.js"],
      experience_years: null,
      location_verified: null,
    });
  });

  it("uses null (not undefined, not a guess) for every missing optional field", () => {
    const normalized = normalizeCandidate({
      source: "mock",
      source_url: "https://example.com/search?q=x",
    });

    expect(normalized).toEqual({
      name: null,
      headline: null,
      current_company: null,
      location: null,
      profile_url: null,
      profile_image_url: null,
      source: "mock",
      source_url: "https://example.com/search?q=x",
      summary: null,
      skills: [],
      experience_years: null,
      location_verified: null,
    });
  });

  it("never fabricates experience_years even when the snippet mentions years of experience", () => {
    const normalized = normalizeCandidate({
      source: "mock",
      source_url: "https://example.com/search?q=x",
      snippet: "5+ years of experience in React and TypeScript.",
    });

    expect(normalized.experience_years).toBeNull();
  });

  it("passes through experience_years when a structured source (e.g. Apify enrichment) supplied one", () => {
    const normalized = normalizeCandidate({
      source: "serpapi",
      source_url: "https://linkedin.com/in/amina-hassan",
      experience_years: 4.5,
    });

    expect(normalized.experience_years).toBe(4.5);
  });

  it("produces schema-valid output for every fixture returned by MockSearchProvider", async () => {
    const provider = new MockSearchProvider();
    const rawResults = await provider.searchCandidates({ query: "react developer" });

    expect(rawResults.length).toBeGreaterThan(0);

    for (const raw of rawResults) {
      const normalized = normalizeCandidate(raw);
      const result = normalizedCandidateSchema.safeParse(normalized);
      expect(result.success).toBe(true);
    }
  });

  it("normalizing the MockSearchProvider fixtures produces at least one null in every optional field, matching the fixtures' deliberate gaps", async () => {
    const provider = new MockSearchProvider();
    const rawResults = await provider.searchCandidates({ query: "react developer" });
    const normalized = rawResults.map(normalizeCandidate);

    expect(normalized.some((c) => c.name === null)).toBe(true);
    expect(normalized.some((c) => c.current_company === null)).toBe(true);
    expect(normalized.some((c) => c.location === null)).toBe(true);
    expect(normalized.some((c) => c.profile_url === null)).toBe(true);
    expect(normalized.some((c) => c.skills.length === 0)).toBe(true);
    expect(normalized.every((c) => c.experience_years === null)).toBe(true);
  });
});
