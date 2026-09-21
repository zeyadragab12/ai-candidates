import { z } from "zod";

export const jobCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
  location: z.string().trim().default(""),
  employment_type: z.string().trim().default(""),
  work_arrangement: z.string().trim().default(""),
  seniority: z.string().trim().default(""),
  required_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  minimum_experience: z.number().nullable().default(null),
  maximum_experience: z.number().nullable().default(null),
  education: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  ai_analysis: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const jobUpdateSchema = jobCreateSchema.partial();

export type JobCreateInput = z.infer<typeof jobCreateSchema>;
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;
