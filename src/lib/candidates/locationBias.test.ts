import { describe, expect, it } from "vitest";

import {
  resolveCleanLocationText,
  resolveEgyptSearchLocation,
  shouldApplyLocationBias,
} from "./locationBias";

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

describe("resolveEgyptSearchLocation", () => {
  it("returns no params for a non-geographic or empty location", () => {
    expect(resolveEgyptSearchLocation("Remote")).toEqual({});
    expect(resolveEgyptSearchLocation(null)).toEqual({});
    expect(resolveEgyptSearchLocation("")).toEqual({});
  });

  it("searches at country granularity for a bare 'Egypt' value", () => {
    expect(resolveEgyptSearchLocation("Egypt")).toEqual({
      location: "Egypt",
      countryCode: "eg",
      googleDomain: "google.com.eg",
    });
  });

  it("keeps a specific governorate/city but still adds the country code", () => {
    expect(resolveEgyptSearchLocation("Cairo, Egypt")).toEqual({
      location: "Cairo, Egypt",
      countryCode: "eg",
      googleDomain: "google.com.eg",
    });
    expect(resolveEgyptSearchLocation("Giza")).toEqual({
      location: "Giza",
      countryCode: "eg",
      googleDomain: "google.com.eg",
    });
  });

  it("passes through a non-Egypt location unchanged, with no country code", () => {
    expect(resolveEgyptSearchLocation("Berlin, Germany")).toEqual({
      location: "Berlin, Germany",
    });
  });

  it("falls back to country-level 'Egypt' for a malformed multi-city value, rather than passing it through (SerpApi 400s on anything non-canonical)", () => {
    expect(resolveEgyptSearchLocation("Egypt; Cairo, Giza, Mansoura, Alex")).toEqual({
      location: "Egypt",
      countryCode: "eg",
      googleDomain: "google.com.eg",
    });
  });

  it("falls back to country-level 'Egypt' for a list of multiple governorates", () => {
    expect(resolveEgyptSearchLocation("Cairo, Giza, Alexandria")).toEqual({
      location: "Egypt",
      countryCode: "eg",
      googleDomain: "google.com.eg",
    });
  });
});

describe("resolveCleanLocationText", () => {
  it("returns null for a non-geographic or empty location", () => {
    expect(resolveCleanLocationText("Remote")).toBeNull();
    expect(resolveCleanLocationText(null)).toBeNull();
    expect(resolveCleanLocationText("")).toBeNull();
  });

  it("returns a clean governorate/city or country value unchanged", () => {
    expect(resolveCleanLocationText("Cairo, Egypt")).toBe("Cairo, Egypt");
    expect(resolveCleanLocationText("Giza")).toBe("Giza");
    expect(resolveCleanLocationText("Egypt")).toBe("Egypt");
  });

  it("collapses a malformed multi-city value to 'Egypt', never the raw list", () => {
    // The literal bug: quoting this whole string in a search query asks
    // Google to match text no real profile contains, and it silently
    // drops the query's real constraints instead — confirmed live to
    // return unrelated noise (a professor, a pharmacist, ...) rather than
    // Egypt-based Salesforce candidates.
    expect(resolveCleanLocationText("Egypt; Cairo, Giza, Mansoura, Alex")).toBe("Egypt");
    expect(resolveCleanLocationText("Egypt, Cairo, Giza, Alex")).toBe("Egypt");
    expect(resolveCleanLocationText("Cairo, Giza, Alexandria")).toBe("Egypt");
  });

  it("passes through a non-Egypt location unchanged", () => {
    expect(resolveCleanLocationText("Berlin, Germany")).toBe("Berlin, Germany");
  });
});
