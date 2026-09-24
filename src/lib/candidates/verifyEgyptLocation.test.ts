import { describe, expect, it, vi } from "vitest";

import { filterToEgyptCandidates } from "./verifyEgyptLocation";
import type { AIProvider } from "@/lib/ai/AIProvider";
import type { CandidateSearchResult } from "@/types/search";

function makeResult(overrides: Partial<CandidateSearchResult> = {}): CandidateSearchResult {
  return {
    source: "serpapi",
    source_url: "https://linkedin.com/in/x",
    ...overrides,
  };
}

function makeAIProvider(response: unknown): AIProvider {
  return { generateText: vi.fn().mockResolvedValue(JSON.stringify(response)) };
}

describe("filterToEgyptCandidates", () => {
  it("keeps a candidate whose location text mentions Egypt (Tier 1, no AI call)", async () => {
    const provider = makeAIProvider({ in_egypt: null, evidence: "" });
    const results = [makeResult({ location: "Cairo, Egypt" })];

    const filtered = await filterToEgyptCandidates(results, provider);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.location_verified).toBe(true);
    expect(provider.generateText).not.toHaveBeenCalled();
  });

  it("excludes a candidate whose location text names a different place (Tier 1, no AI call)", async () => {
    const provider = makeAIProvider({ in_egypt: null, evidence: "" });
    const results = [makeResult({ location: "Dubai, United Arab Emirates" })];

    const filtered = await filterToEgyptCandidates(results, provider);

    expect(filtered).toHaveLength(0);
    expect(provider.generateText).not.toHaveBeenCalled();
  });

  it("falls back to the AI tier when location is missing, and keeps a confirmed match", async () => {
    const provider = makeAIProvider({ in_egypt: true, evidence: "Headline says Cairo" });
    const results = [makeResult({ title: "Engineer based in Cairo" })];

    const filtered = await filterToEgyptCandidates(results, provider);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.location_verified).toBe(true);
    expect(provider.generateText).toHaveBeenCalledTimes(1);
  });

  it("excludes a candidate the AI tier confirms is elsewhere", async () => {
    const provider = makeAIProvider({ in_egypt: false, evidence: "Headline says Berlin" });
    const results = [makeResult({ title: "Engineer based in Berlin" })];

    const filtered = await filterToEgyptCandidates(results, provider);

    expect(filtered).toHaveLength(0);
  });

  it("keeps a candidate the AI tier can't determine (null is never excluded)", async () => {
    const provider = makeAIProvider({ in_egypt: null, evidence: "" });
    const results = [makeResult({ title: "Software Engineer" })];

    const filtered = await filterToEgyptCandidates(results, provider);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.location_verified).toBeNull();
  });

  it("skips the AI call entirely when there's no text at all to read", async () => {
    const provider = makeAIProvider({ in_egypt: null, evidence: "" });
    const results = [makeResult()];

    const filtered = await filterToEgyptCandidates(results, provider);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.location_verified).toBeNull();
    expect(provider.generateText).not.toHaveBeenCalled();
  });

  it("keeps the candidate (fails soft) when the AI call itself throws", async () => {
    const provider: AIProvider = {
      generateText: vi.fn().mockRejectedValue(new Error("OpenAI is down")),
    };
    const results = [makeResult({ title: "Software Engineer" })];

    const filtered = await filterToEgyptCandidates(results, provider);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.location_verified).toBeNull();
  });
});
