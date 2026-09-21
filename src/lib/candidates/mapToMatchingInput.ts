import type { JobAnalysis } from "@/types/job-analysis";
import type { MatchingCandidateInput, MatchingJobInput } from "@/types/matching";

interface JobRow {
  title: string;
  seniority: string | null;
  location: string | null;
  required_skills: string[] | null;
  preferred_skills: string[] | null;
  minimum_experience: number | null;
  maximum_experience: number | null;
  education: string[] | null;
  certifications: string[] | null;
  ai_analysis: Partial<JobAnalysis> | null;
}

interface CandidateRow {
  name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  skills: string[] | null;
  experience_years: number | null;
  summary: string | null;
}

export function jobRowToMatchingInput(job: JobRow): MatchingJobInput {
  return {
    job_title: job.title,
    seniority: job.seniority ?? "",
    location: job.location ?? "",
    required_skills: job.required_skills ?? [],
    preferred_skills: job.preferred_skills ?? [],
    years_of_experience: {
      minimum: job.minimum_experience,
      maximum: job.maximum_experience,
    },
    education: job.education ?? [],
    certifications: job.certifications ?? [],
    industries: job.ai_analysis?.industries ?? [],
    responsibilities: job.ai_analysis?.responsibilities ?? [],
  };
}

export function candidateRowToMatchingInput(
  candidate: CandidateRow,
): MatchingCandidateInput {
  return {
    name: candidate.name,
    headline: candidate.headline,
    company: candidate.company,
    location: candidate.location,
    skills: candidate.skills ?? [],
    experience_years: candidate.experience_years,
    summary: candidate.summary,
  };
}
