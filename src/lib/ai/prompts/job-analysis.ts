import type { AIProvider } from "@/lib/ai/AIProvider";
import { parseJsonResponse } from "@/lib/ai/parseJsonResponse";
import { jobAnalysisSchema, type JobAnalysis } from "@/types/job-analysis";

const SYSTEM_INSTRUCTION = `You are an expert technical recruiter. You extract structured requirements from job descriptions.
Only use information present in the job description. Never invent skills, requirements, or numbers that are not stated or clearly implied.
If a field cannot be determined from the text, use an empty string, empty array, or null as appropriate.
Respond with raw JSON only. Do not wrap the JSON in markdown code fences.`;

export function buildJobAnalysisPrompt(jobDescriptionText: string): string {
  return `Analyze the following job description and extract structured information as JSON matching exactly this shape:

{
  "job_title": string,
  "seniority": string,
  "location": string,
  "employment_type": string,
  "required_skills": string[],
  "preferred_skills": string[],
  "years_of_experience": { "minimum": number | null, "maximum": number | null },
  "education": string[],
  "certifications": string[],
  "languages": string[],
  "industries": string[],
  "keywords": string[],
  "responsibilities": string[],
  "search_keywords": string[],
  "search_queries": string[]
}

Job Description:
"""
${jobDescriptionText}
"""`;
}

export async function analyzeJobDescription(
  jobDescriptionText: string,
  provider: AIProvider,
): Promise<JobAnalysis> {
  const prompt = buildJobAnalysisPrompt(jobDescriptionText);

  const rawResponse = await provider.generateText(prompt, {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.2,
    jsonMode: true,
  });

  return parseJsonResponse(rawResponse, jobAnalysisSchema, "job-analysis");
}
