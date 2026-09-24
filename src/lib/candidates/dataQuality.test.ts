import { describe, expect, it } from "vitest";

import { isImplausibleCompany, isImplausibleExperienceYears } from "./dataQuality";

describe("isImplausibleCompany", () => {
  it("flags our own recruiting company name", () => {
    expect(isImplausibleCompany("G Developments")).toBe(true);
    expect(isImplausibleCompany("g developments")).toBe(true);
  });

  it("flags our own company name with a legal-entity suffix or punctuation variant", () => {
    expect(isImplausibleCompany("G Developments Inc.")).toBe(true);
    expect(isImplausibleCompany("G Developments, LLC")).toBe(true);
  });

  it("flags a value matching the hiring job's own company name", () => {
    expect(isImplausibleCompany("Acme Corp", "Acme Corp")).toBe(true);
    expect(isImplausibleCompany("Acme Corp Inc.", "Acme Corp")).toBe(true);
  });

  it("does not flag a real, unrelated employer", () => {
    expect(isImplausibleCompany("Nile Software Solutions")).toBe(false);
    expect(isImplausibleCompany("Acme Corp", "Globex Inc")).toBe(false);
  });

  it("does not flag a null/undefined/empty company (nothing to reject)", () => {
    expect(isImplausibleCompany(null)).toBe(false);
    expect(isImplausibleCompany(undefined)).toBe(false);
    expect(isImplausibleCompany("")).toBe(false);
  });
});

describe("isImplausibleExperienceYears", () => {
  it("flags a negative value", () => {
    expect(isImplausibleExperienceYears(-1)).toBe(true);
  });

  it("flags an implausibly large value (parsing artifact, not a real career length)", () => {
    expect(isImplausibleExperienceYears(80)).toBe(true);
  });

  it("flags a non-finite value", () => {
    expect(isImplausibleExperienceYears(Number.NaN)).toBe(true);
    expect(isImplausibleExperienceYears(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it("does not flag a plausible value", () => {
    expect(isImplausibleExperienceYears(0)).toBe(false);
    expect(isImplausibleExperienceYears(12)).toBe(false);
    expect(isImplausibleExperienceYears(60)).toBe(false);
  });

  it("does not flag null/undefined (nothing to reject)", () => {
    expect(isImplausibleExperienceYears(null)).toBe(false);
    expect(isImplausibleExperienceYears(undefined)).toBe(false);
  });
});
