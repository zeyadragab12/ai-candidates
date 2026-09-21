import type { AIProvider } from "@/lib/ai/AIProvider";
import { parseJsonResponse } from "@/lib/ai/parseJsonResponse";
import {
  matchResultSchema,
  type MatchResult,
  type MatchingJobInput,
  type MatchingCandidateInput,
} from "@/types/matching";

const SYSTEM_INSTRUCTION = `You are an expert technical recruiter scoring how well a candidate matches a job's requirements.
Every sub-score must be explicitly justified by comparing the candidate's actual data against the job's stated requirements — never assign a score based on a general impression.
The candidate record often lacks structured education or seniority fields; when the available text (headline, summary, skills) does not give you enough evidence to judge a dimension, score it conservatively (do not assume it's satisfied) and say so in "concerns".
Never invent skills, experience, or qualifications the candidate's data doesn't show.
Respond with raw JSON only. Do not wrap the JSON in markdown code fences.`;

function formatExperienceRange(range: MatchingJobInput["years_of_experience"]): string {
  if (range.minimum === null && range.maximum === null) return "(not specified)";
  if (range.maximum === null) return `${range.minimum}+ years`;
  if (range.minimum === null) return `up to ${range.maximum} years`;
  return `${range.minimum}-${range.maximum} years`;
}

export function buildCandidateMatchingPrompt(
  job: MatchingJobInput,
  candidate: MatchingCandidateInput,
): string {
  return `Compare this candidate against this job's requirements and produce a structured match assessment as JSON matching exactly this shape:

{
  "match_score": number (0-100, overall weighted score),
  "skills_score": number (0-100, based on required_skills and preferred_skills overlap with candidate.skills),
  "experience_score": number (0-100, based on candidate.experience_years vs the job's years_of_experience range),
  "location_score": number (0-100, based on candidate.location vs the job's location; 100 if they match or the job has no location requirement),
  "education_score": number (0-100, based on whether the candidate's available text suggests the job's education requirements are met; score conservatively if there isn't enough information),
  "seniority_score": number (0-100, based on whether the candidate's headline/summary/experience suggests the job's seniority level),
  "matched_requirements": string[] (specific requirements from the job that this candidate's data clearly satisfies),
  "missing_requirements": string[] (specific requirements from the job that this candidate's data does not show),
  "strengths": string[] (specific, evidence-based strengths of this candidate for this role),
  "concerns": string[] (specific concerns, including any dimension where there wasn't enough data to score confidently),
  "summary": string (2-3 sentence overall assessment)
}

Job:
- Title: ${job.job_title}
- Seniority: ${job.seniority || "(not specified)"}
- Location: ${job.location || "(not specified)"}
- Required skills: ${job.required_skills.join(", ") || "(none listed)"}
- Preferred skills: ${job.preferred_skills.join(", ") || "(none listed)"}
- Years of experience required: ${formatExperienceRange(job.years_of_experience)}
- Education requirements: ${job.education.join(", ") || "(none listed)"}
- Certifications: ${job.certifications.join(", ") || "(none listed)"}
- Industries: ${job.industries.join(", ") || "(none listed)"}
- Key responsibilities: ${job.responsibilities.join("; ") || "(none listed)"}

Candidate:
- Name: ${candidate.name ?? "(unknown)"}
- Headline: ${candidate.headline ?? "(unknown)"}
- Current company: ${candidate.company ?? "(unknown)"}
- Location: ${candidate.location ?? "(unknown)"}
- Skills: ${candidate.skills.join(", ") || "(none listed)"}
- Years of experience: ${candidate.experience_years ?? "(unknown)"}
- Summary: ${candidate.summary ?? "(none available)"}`;
}

export async function matchCandidateToJob(
  job: MatchingJobInput,
  candidate: MatchingCandidateInput,
  provider: AIProvider,
): Promise<MatchResult> {
  const prompt = buildCandidateMatchingPrompt(job, candidate);

  const rawResponse = await provider.generateText(prompt, {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.2,
    jsonMode: true,
  });

  return parseJsonResponse(rawResponse, matchResultSchema, "candidate-matching");
}
