import { describe, expect, it } from "vitest";

import { buildCandidateMatchingPrompt } from "./candidate-matching";
import { matchResultSchema } from "@/types/matching";
import type { MatchingCandidateInput, MatchingJobInput } from "@/types/matching";

function makeJob(overrides: Partial<MatchingJobInput> = {}): MatchingJobInput {
  return {
    job_title: "Frontend React Developer",
    seniority: "Mid",
    location: "Cairo, Egypt",
    required_skills: ["React", "TypeScript"],
    preferred_skills: ["Next.js"],
    years_of_experience: { minimum: 3, maximum: null },
    education: ["Bachelor's in Computer Science"],
    certifications: [],
    industries: [],
    responsibilities: ["Build UI components"],
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<MatchingCandidateInput> = {},
): MatchingCandidateInput {
  return {
    name: "Amina Hassan",
    headline: "Senior React Developer",
    company: "Nile Software",
    location: "Cairo, Egypt",
    skills: ["React", "TypeScript", "Next.js"],
    experience_years: 5,
    summary: "5+ years building React apps.",
    ...overrides,
  };
}

describe("matchResultSchema", () => {
  it("accepts a fully valid match result", () => {
    const result = matchResultSchema.safeParse({
      match_score: 87,
      skills_score: 92,
      experience_score: 85,
      location_score: 100,
      education_score: 80,
      seniority_score: 90,
      matched_requirements: ["React", "TypeScript"],
      missing_requirements: ["AWS"],
      strengths: ["Strong React background"],
      concerns: ["Education not verifiable from available data"],
      summary: "Strong match overall.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a score above 100", () => {
    expect(
      matchResultSchema.safeParse({
        match_score: 150,
        skills_score: 50,
        experience_score: 50,
        location_score: 50,
        education_score: 50,
        seniority_score: 50,
        matched_requirements: [],
        missing_requirements: [],
        strengths: [],
        concerns: [],
        summary: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects a negative score", () => {
    expect(
      matchResultSchema.safeParse({
        match_score: -5,
        skills_score: 50,
        experience_score: 50,
        location_score: 50,
        education_score: 50,
        seniority_score: 50,
        matched_requirements: [],
        missing_requirements: [],
        strengths: [],
        concerns: [],
        summary: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects a response missing a required sub-score", () => {
    expect(
      matchResultSchema.safeParse({
        match_score: 80,
        skills_score: 80,
        experience_score: 80,
        location_score: 80,
        seniority_score: 80,
        matched_requirements: [],
        missing_requirements: [],
        strengths: [],
        concerns: [],
        summary: "x",
      }).success,
    ).toBe(false);
  });
});

describe("buildCandidateMatchingPrompt", () => {
  it("includes explicit job criteria and candidate data for every sub-score dimension", () => {
    const prompt = buildCandidateMatchingPrompt(makeJob(), makeCandidate());

    // Skills
    expect(prompt).toContain("React, TypeScript");
    // Experience
    expect(prompt).toContain("3+ years");
    expect(prompt).toContain("Years of experience: 5");
    // Location
    expect(prompt).toContain("Cairo, Egypt");
    // Education
    expect(prompt).toContain("Bachelor's in Computer Science");
    // Seniority
    expect(prompt).toContain("Seniority: Mid");
  });

  it("handles missing job/candidate fields without crashing", () => {
    const prompt = buildCandidateMatchingPrompt(
      makeJob({ seniority: "", location: "", education: [] }),
      makeCandidate({ headline: null, location: null, summary: null }),
    );
    expect(prompt).toContain("(not specified)");
    expect(prompt).toContain("(unknown)");
  });
});
