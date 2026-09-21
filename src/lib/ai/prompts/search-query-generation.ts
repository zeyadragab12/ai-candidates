import { z } from "zod";

import type { AIProvider } from "@/lib/ai/AIProvider";
import { parseJsonResponse } from "@/lib/ai/parseJsonResponse";
import type { JobAnalysis } from "@/types/job-analysis";

export const searchQueryGenerationSchema = z.object({
  search_queries: z
    .array(z.string().min(1))
    .min(2, "Expected at least 2 search query variants.")
    .max(4, "Expected at most 4 search query variants."),
});

export type SearchQueryGenerationResult = z.infer<
  typeof searchQueryGenerationSchema
>;

const SYSTEM_INSTRUCTION = `You are a sourcing assistant that turns job requirements into X-ray boolean search queries for finding INDIVIDUAL candidate profiles on public professional platforms — never companies, job postings, recruitment agencies, or articles.
Every query must follow this exact structure, in this order:
1. A site restriction group: (site:linkedin.com/in OR site:linkedin.com/pub)
2. A job-title group: 3 to 6 real equivalent/synonymous job titles for the role (the given title plus common industry synonyms), each double-quoted and OR'd together in parentheses, e.g. ("Title A" OR "Title B" OR "Title C")
3. Two to five double-quoted required-skill or keyword phrases, space-separated (implicit AND) — pull these from the required skills and keywords provided, using the exact specific/technical phrase (e.g. "root cause analysis", "SOP documentation"), never a vague single word.
4. If a location is given, append it as a plain (unquoted) word or short phrase at the very end of every query — never omit it when one is provided, and never put it inside the title group. This is the recruiter's hard location requirement, not optional context.
Add a seniority term only if it is essential to disambiguate the role.
Never write a full sentence, a question, or a generic query like "<role> developers <location>". Only use information present in the provided requirements — never invent a skill or title that isn't implied by it.
Respond with raw JSON only. Do not wrap the JSON in markdown code fences.`;

export function buildSearchQueryGenerationPrompt(
  jobAnalysis: JobAnalysis,
): string {
  return `Generate 2 to 4 X-ray boolean search query variants for finding INDIVIDUAL candidates matching these requirements — real people's profile pages, not companies, job ads, or agencies. Respond as JSON matching exactly this shape:

{
  "search_queries": string[]
}

Job Title: ${jobAnalysis.job_title}
Seniority: ${jobAnalysis.seniority || "(not specified)"}
Location: ${jobAnalysis.location || "(not specified)"}
Required Skills: ${jobAnalysis.required_skills.join(", ") || "(none listed)"}
Preferred Skills: ${jobAnalysis.preferred_skills.join(", ") || "(none listed)"}
Keywords: ${jobAnalysis.keywords.join(", ") || "(none listed)"}

Example of the expected structure (site group, then OR'd quoted title synonyms in parentheses, then quoted skill/keyword phrases, then the location as a trailing plain word):
(site:linkedin.com/in OR site:linkedin.com/pub) ("Transformation Excellence Senior Specialist" OR "Operational Excellence Senior Specialist" OR "Process Improvement Specialist" OR "Quality Assurance Senior Specialist") "process mapping" "SOP documentation" "root cause analysis" "CAPA" Egypt

Never generate a query without the (site:linkedin.com/in OR site:linkedin.com/pub) group, never generate a query without the OR'd title group in parentheses, never drop the location when one is given, and never generate a generic query such as "React developers Egypt" or "React companies Egypt".`;
}

export async function generateSearchQueries(
  jobAnalysis: JobAnalysis,
  provider: AIProvider,
): Promise<string[]> {
  const prompt = buildSearchQueryGenerationPrompt(jobAnalysis);

  const rawResponse = await provider.generateText(prompt, {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.4,
    jsonMode: true,
  });

  const result = parseJsonResponse(
    rawResponse,
    searchQueryGenerationSchema,
    "search-query-generation",
  );

  return result.search_queries;
}
