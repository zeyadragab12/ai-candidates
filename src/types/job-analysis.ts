import { z } from "zod";

export const jobAnalysisSchema = z.object({
  job_title: z.string().min(1),
  seniority: z.string().default(""),
  // Fixed to "Egypt" — every job sources nationwide (see jobs/new/page.tsx's
  // handleAnalyze). Required at the API layer (see jobCreateSchema).
  location: z.string().default(""),
  // Optional recruiter-picked city (Cairo/Alexandria/Giza/Suez), never
  // AI-extracted — when set, narrows the quoted location phrase in
  // generated search queries and the SerpApi location param down from the
  // nationwide "Egypt" `location` value to this specific city.
  city: z.string().default(""),
  employment_type: z.string().default(""),
  required_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  years_of_experience: z
    .object({
      minimum: z.number().nullable().default(null),
      maximum: z.number().nullable().default(null),
    })
    .default({ minimum: null, maximum: null }),
  education: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  search_keywords: z.array(z.string()).default([]),
  search_queries: z.array(z.string()).default([]),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
