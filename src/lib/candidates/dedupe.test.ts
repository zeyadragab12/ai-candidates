import { describe, expect, it } from "vitest";

import { dedupeCandidates } from "./dedupe";
import type { NormalizedCandidate } from "@/types/candidate";

function makeCandidate(
  overrides: Partial<NormalizedCandidate> = {},
): NormalizedCandidate {
  return {
    name: null,
    headline: null,
    current_company: null,
    location: null,
    profile_url: null,
    profile_image_url: null,
    source: "mock",
    source_url: "https://example.com/search",
    summary: null,
    skills: [],
    experience_years: null,
    ...overrides,
  };
}

describe("dedupeCandidates", () => {
  it("merges two candidates with the same profile_url into 1 record", () => {
    const result = dedupeCandidates([
      makeCandidate({ name: "Amina Hassan", profile_url: "https://example.com/in/amina" }),
      makeCandidate({ name: "Amina Hassan", profile_url: "https://example.com/in/amina" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("treats profile_url matches as the same regardless of protocol/case/trailing slash", () => {
    const result = dedupeCandidates([
      makeCandidate({ profile_url: "https://example.com/in/amina" }),
      makeCandidate({ profile_url: "HTTP://EXAMPLE.COM/in/amina/" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("merges two candidates with the same name+company and no profile_url into 1 record", () => {
    const result = dedupeCandidates([
      makeCandidate({ name: "Sara Youssef", current_company: "Delta Digital" }),
      makeCandidate({ name: "Sara Youssef", current_company: "Delta Digital" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("keeps genuinely different candidates as 2 separate records", () => {
    const result = dedupeCandidates([
      makeCandidate({ name: "Amina Hassan", profile_url: "https://example.com/in/amina" }),
      makeCandidate({ name: "Omar El-Sayed", profile_url: "https://example.com/in/omar" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("does NOT merge candidates with the same name but different companies (avoids false positives)", () => {
    const result = dedupeCandidates([
      makeCandidate({ name: "Mohamed Ahmed", current_company: "Company A" }),
      makeCandidate({ name: "Mohamed Ahmed", current_company: "Company B" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("does NOT merge candidates that share only a name with no company on either side (too ambiguous)", () => {
    const result = dedupeCandidates([
      makeCandidate({ name: "Mohamed Ahmed" }),
      makeCandidate({ name: "Mohamed Ahmed" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("does NOT merge across identity keyspaces: one has a profile_url, the other only matches by name+company", () => {
    // This is a deliberate missed-duplicate: without a shared profile_url,
    // merging here would be a guess. A missed duplicate is an acceptable
    // trade-off; a false-positive merge of two different people is not.
    const result = dedupeCandidates([
      makeCandidate({ name: "Karim Mostafa", current_company: "Alexandria Tech" }),
      makeCandidate({
        name: "Karim Mostafa",
        current_company: "Alexandria Tech",
        profile_url: "https://example.com/in/karim",
      }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("never merges two candidates with neither a profile_url nor a name+company pair", () => {
    const result = dedupeCandidates([
      makeCandidate({ summary: "Frontend developer profile." }),
      makeCandidate({ summary: "Frontend developer profile." }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("fills in missing fields from a later duplicate without overwriting known data", () => {
    const result = dedupeCandidates([
      makeCandidate({
        profile_url: "https://example.com/in/amina",
        name: "Amina Hassan",
        skills: ["React"],
      }),
      makeCandidate({
        profile_url: "https://example.com/in/amina",
        current_company: "Nile Software Solutions",
        skills: ["TypeScript"],
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "Amina Hassan",
      current_company: "Nile Software Solutions",
    });
    expect(result[0]?.skills.sort()).toEqual(["React", "TypeScript"]);
  });

  it("BEFORE this change would have kept these as 2 separate records: merges the same LinkedIn profile found via different country subdomains across search runs", () => {
    const result = dedupeCandidates([
      makeCandidate({
        name: "Amina Hassan",
        profile_url: "https://www.linkedin.com/in/amina-hassan",
      }),
      makeCandidate({
        name: "Amina Hassan",
        profile_url: "https://eg.linkedin.com/in/amina-hassan/?trk=public_profile",
      }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("does not merge two different LinkedIn profiles with different slugs", () => {
    const result = dedupeCandidates([
      makeCandidate({ profile_url: "https://www.linkedin.com/in/amina-hassan" }),
      makeCandidate({ profile_url: "https://eg.linkedin.com/in/amina-hassan-2" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("BEFORE this change would have kept these as 2 separate records: merges name+company across a company-name legal-suffix variant", () => {
    const result = dedupeCandidates([
      makeCandidate({ name: "Sara Youssef", current_company: "Delta Digital Inc." }),
      makeCandidate({ name: "Sara Youssef", current_company: "Delta Digital" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("BEFORE this change would have kept these as 2 separate records: merges name+company across an accented-name variant", () => {
    const result = dedupeCandidates([
      makeCandidate({ name: "Andre Dupont", current_company: "Nile Software" }),
      makeCandidate({ name: "André Dupont", current_company: "Nile Software" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("still does NOT merge different companies that only share a legal-entity suffix (avoids false positives)", () => {
    const result = dedupeCandidates([
      makeCandidate({ name: "Mohamed Ahmed", current_company: "Acme Inc." }),
      makeCandidate({ name: "Mohamed Ahmed", current_company: "Globex Inc." }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("handles 3+ duplicates of the same candidate, merging all of them into 1 record", () => {
    const result = dedupeCandidates([
      makeCandidate({ profile_url: "https://example.com/in/x", name: "X" }),
      makeCandidate({ profile_url: "https://example.com/in/x", location: "Cairo" }),
      makeCandidate({ profile_url: "https://example.com/in/x", current_company: "Acme" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "X",
      location: "Cairo",
      current_company: "Acme",
    });
  });
});
