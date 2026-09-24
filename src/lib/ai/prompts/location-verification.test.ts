import { describe, expect, it, vi } from "vitest";

import { verifyEgyptLocationWithAI } from "./location-verification";
import type { AIProvider } from "@/lib/ai/AIProvider";

describe("verifyEgyptLocationWithAI", () => {
  it("skips the AI call and returns null when there's no text at all", async () => {
    const provider: AIProvider = { generateText: vi.fn() };

    const result = await verifyEgyptLocationWithAI(
      { headline: null, summary: null, currentCompany: null },
      provider,
    );

    expect(result).toEqual({ in_egypt: null, evidence: "" });
    expect(provider.generateText).not.toHaveBeenCalled();
  });

  it("parses a valid AI response", async () => {
    const provider: AIProvider = {
      generateText: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ in_egypt: true, evidence: "Mentions Cairo" })),
    };

    const result = await verifyEgyptLocationWithAI(
      { headline: "Engineer in Cairo", summary: null, currentCompany: null },
      provider,
    );

    expect(result).toEqual({ in_egypt: true, evidence: "Mentions Cairo" });
  });

  it("throws when the AI response doesn't match the schema", async () => {
    const provider: AIProvider = {
      generateText: vi.fn().mockResolvedValue(JSON.stringify({ nonsense: true })),
    };

    await expect(
      verifyEgyptLocationWithAI({ headline: "x", summary: null, currentCompany: null }, provider),
    ).rejects.toThrow();
  });
});
