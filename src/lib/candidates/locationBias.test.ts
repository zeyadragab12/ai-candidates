import { describe, expect, it } from "vitest";

import { shouldApplyLocationBias } from "./locationBias";

describe("shouldApplyLocationBias", () => {
  it("applies bias for a real geographic value", () => {
    expect(shouldApplyLocationBias("Cairo, Egypt")).toBe(true);
    expect(shouldApplyLocationBias("Berlin, Germany")).toBe(true);
  });

  it("does not apply bias for empty/null/undefined", () => {
    expect(shouldApplyLocationBias(null)).toBe(false);
    expect(shouldApplyLocationBias(undefined)).toBe(false);
    expect(shouldApplyLocationBias("")).toBe(false);
    expect(shouldApplyLocationBias("   ")).toBe(false);
  });

  it("does not apply bias for non-geographic placeholder values, case-insensitively", () => {
    expect(shouldApplyLocationBias("Remote")).toBe(false);
    expect(shouldApplyLocationBias("REMOTE")).toBe(false);
    expect(shouldApplyLocationBias("Remote, Global")).toBe(false);
    expect(shouldApplyLocationBias("Global")).toBe(false);
    expect(shouldApplyLocationBias("Worldwide")).toBe(false);
    expect(shouldApplyLocationBias("Anywhere")).toBe(false);
    expect(shouldApplyLocationBias("N/A")).toBe(false);
    expect(shouldApplyLocationBias("TBD")).toBe(false);
  });
});
