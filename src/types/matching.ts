import { z } from "zod";

export const matchResultSchema = z.object({
  match_score: z.number().min(0).max(100),
  skills_score: z.number().min(0).max(100),
  experience_score: z.number().min(0).max(100),
  location_score: z.number().min(0).max(100),
  education_score: z.number().min(0).max(100),
  seniority_score: z.number().min(0).max(100),
  matched_requirements: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  summary: z.string(),
});

export type MatchResult = z.infer<typeof matchResultSchema>;

export interface MatchingJobInput {
  job_title: string;
  seniority: string;
  location: string;
  required_skills: string[];
  preferred_skills: string[];
  years_of_experience: { minimum: number | null; maximum: number | null };
  education: string[];
  certifications: string[];
  industries: string[];
  responsibilities: string[];
}

export interface MatchingCandidateInput {
  name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  skills: string[];
  experience_years: number | null;
  summary: string | null;
}
