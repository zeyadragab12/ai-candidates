import { describe, expect, it } from "vitest";

import { MockSearchProvider } from "./MockSearchProvider";

describe("MockSearchProvider", () => {
  it("returns between 5 and 10 fixture candidates", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "react developer" });
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it("is deterministic across calls with the same params", async () => {
    const provider = new MockSearchProvider();
    const first = await provider.searchCandidates({ query: "react developer" });
    const second = await provider.searchCandidates({ query: "react developer" });
    expect(first).toEqual(second);
  });

  it("is deterministic regardless of the query text", async () => {
    const provider = new MockSearchProvider();
    const a = await provider.searchCandidates({ query: "anything" });
    const b = await provider.searchCandidates({ query: "something else entirely" });
    expect(a).toEqual(b);
  });

  it("includes candidates missing company", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "x" });
    expect(results.some((c) => c.company === undefined)).toBe(true);
  });

  it("includes candidates missing location", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "x" });
    expect(results.some((c) => c.location === undefined)).toBe(true);
  });

  it("includes candidates missing skills", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "x" });
    expect(results.some((c) => c.skills === undefined)).toBe(true);
  });

  it("includes candidates missing profile_url", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "x" });
    expect(results.some((c) => c.profile_url === undefined)).toBe(true);
  });

  it("includes candidates missing name", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "x" });
    expect(results.some((c) => c.name === undefined)).toBe(true);
  });

  it("every candidate has the required source and source_url fields", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "x" });
    for (const candidate of results) {
      expect(candidate.source).toBeTruthy();
      expect(candidate.source_url).toBeTruthy();
    }
  });

  it("respects the limit param", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "x", limit: 3 });
    expect(results).toHaveLength(3);
  });

  it("returns an empty array for page 2 (only one fixed page of fixtures)", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.searchCandidates({ query: "x", page: 2 });
    expect(results).toEqual([]);
  });
});
