import { describe, expect, it } from "vitest";

import { mentionsEgyptLocation } from "./egyptLocations";

describe("mentionsEgyptLocation", () => {
  it("matches the bare country name and code, case-insensitively", () => {
    expect(mentionsEgyptLocation("Egypt")).toBe(true);
    expect(mentionsEgyptLocation("EGYPT")).toBe(true);
    expect(mentionsEgyptLocation("EG")).toBe(true);
  });

  it("matches a governorate name, including multi-word ones", () => {
    expect(mentionsEgyptLocation("Cairo, Egypt")).toBe(true);
    expect(mentionsEgyptLocation("Giza")).toBe(true);
    expect(mentionsEgyptLocation("Port Said, Egypt")).toBe(true);
    expect(mentionsEgyptLocation("New Valley")).toBe(true);
  });

  it("does not match an unrelated location", () => {
    expect(mentionsEgyptLocation("Dubai, United Arab Emirates")).toBe(false);
    expect(mentionsEgyptLocation("Berlin, Germany")).toBe(false);
  });

  it("does not match a substring buried inside an unrelated word", () => {
    // "eg" must not match inside "legal", "vegetable", etc.
    expect(mentionsEgyptLocation("Legal Counsel, Remote")).toBe(false);
  });

  it("returns false for null/undefined/empty text", () => {
    expect(mentionsEgyptLocation(null)).toBe(false);
    expect(mentionsEgyptLocation(undefined)).toBe(false);
    expect(mentionsEgyptLocation("")).toBe(false);
  });
});
