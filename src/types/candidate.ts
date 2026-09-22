import { z } from "zod";

export const normalizedCandidateSchema = z.object({
  name: z.string().nullable(),
  headline: z.string().nullable(),
  current_company: z.string().nullable(),
  location: z.string().nullable(),
  profile_url: z.string().nullable(),
  profile_image_url: z.string().nullable(),
  source: z.string(),
  source_url: z.string(),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  experience_years: z.number().nullable(),
});

export type NormalizedCandidate = z.infer<typeof normalizedCandidateSchema>;
