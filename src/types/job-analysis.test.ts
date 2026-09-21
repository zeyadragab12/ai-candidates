import { describe, expect, it } from "vitest";

import { jobAnalysisSchema } from "./job-analysis";

describe("jobAnalysisSchema", () => {
  it("accepts a fully populated valid object", () => {
    const result = jobAnalysisSchema.safeParse({
      job_title: "Senior React Developer",
      seniority: "Senior",
      location: "Cairo, Egypt",
      employment_type: "Full-time",
      required_skills: ["React", "TypeScript"],
      preferred_skills: ["Next.js"],
      years_of_experience: { minimum: 5, maximum: null },
      education: ["Bachelor's in Computer Science"],
      certifications: [],
      languages: ["English"],
      industries: ["Software"],
      keywords: ["frontend"],
      responsibilities: ["Build UI components"],
      search_keywords: ["react developer"],
      search_queries: ["React Developer Cairo"],
    });
    expect(result.success).toBe(true);
  });

  it("fills in defaults for a minimal object with only job_title", () => {
    const result = jobAnalysisSchema.safeParse({ job_title: "Backend Engineer" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.required_skills).toEqual([]);
      expect(result.data.years_of_experience).toEqual({
        minimum: null,
        maximum: null,
      });
    }
  });

  it("rejects an object missing job_title", () => {
    const result = jobAnalysisSchema.safeParse({ seniority: "Senior" });
    expect(result.success).toBe(false);
  });

  it("rejects an object where required_skills is a string instead of an array", () => {
    const result = jobAnalysisSchema.safeParse({
      job_title: "Developer",
      required_skills: "React, TypeScript",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an object where years_of_experience.minimum is a string", () => {
    const result = jobAnalysisSchema.safeParse({
      job_title: "Developer",
      years_of_experience: { minimum: "5", maximum: null },
    });
    expect(result.success).toBe(false);
  });
});
