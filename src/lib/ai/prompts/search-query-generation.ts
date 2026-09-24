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
3. One or two double-quoted required-skill or keyword phrases, space-separated (implicit AND) — pull these from the required skills and keywords provided. Each phrase must be a short, commonly written term of 1 to 3 words that people actually put on their profiles (e.g. "root cause analysis", "Lean Six Sigma", "CAPA"), never a long descriptive phrase copied from the job description (e.g. NOT "quality checks and validation reviews" or "corrective and preventive actions (CAPA)"). Every extra quoted phrase must appear verbatim on a profile for it to match, so more than two phrases usually returns zero results. Vary which skills each query uses so the variants surface different candidates.
4. If a location is given, append it as a double-quoted phrase at the very end of every query — never omit it when one is provided, and never put it inside the title group. This is the recruiter's hard location requirement, not optional context: quoting it forces the search engine to require that literal text on the page, instead of treating it as an optional hint it can drop.
Add a seniority term only if it is essential to disambiguate the role.
Never write a full sentence, a question, or a generic query like "<role> developers <location>". Only use information present in the provided requirements — never invent a skill or title that isn't implied by it.
Respond with raw JSON only. Do not wrap the JSON in markdown code fences.`;

export function buildSearchQueryGenerationPrompt(
  jobAnalysis: JobAnalysis,
  previousQueries: string[] = [],
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

Previously generated queries for this job (do NOT repeat these or trivially reword them — use different skill/keyword combinations and different title-synonym groupings than every query below):
${previousQueries.length > 0 ? previousQueries.map((query) => `- ${query}`).join("\n") : "(none yet)"}

Example of the expected structure (site group, then OR'd quoted title synonyms in parentheses, then quoted skill/keyword phrases, then the location as a trailing quoted phrase):
(site:linkedin.com/in OR site:linkedin.com/pub) ("Transformation Excellence Senior Specialist" OR "Operational Excellence Senior Specialist" OR "Process Improvement Specialist" OR "Quality Assurance Senior Specialist") "root cause analysis" "CAPA" "Egypt"

Never generate a query without the (site:linkedin.com/in OR site:linkedin.com/pub) group, never generate a query without the OR'd title group in parentheses, never drop the location when one is given, and never generate a generic query such as "React developers Egypt" or "React companies Egypt".`;
}

function normalizeQueryForDedup(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

// Bounded: each retry is a full extra AI call, and this is meant as a
// backstop for the AI slipping up despite the prior-queries context, not the
// primary mechanism for avoiding repeats — keep the worst-case cost small.
const MAX_REGENERATION_ATTEMPTS = 2;

/**
 * `previousQueries` should be every query already generated for this job
 * (e.g. from the search_queries table), so a recruiter re-running "Generate
 * Queries" on the same job gets genuinely different variants instead of
 * near-identical ones. The prior-queries context in the prompt is the main
 * mechanism; the post-response dedup below is a backstop for when the AI
 * slips one through anyway — a duplicate is dropped and, if that leaves
 * fewer than 2 queries, a bounded number of extra generation attempts fill
 * the gap. If every attempt collides entirely with history (pathological),
 * the last attempt's raw output is returned rather than nothing.
 */
export async function generateSearchQueries(
  jobAnalysis: JobAnalysis,
  provider: AIProvider,
  previousQueries: string[] = [],
): Promise<string[]> {
  const seenNormalized = new Set(previousQueries.map(normalizeQueryForDedup));
  const accepted: string[] = [];
  let lastRawQueries: string[] = [];

  for (
    let attempt = 0;
    attempt <= MAX_REGENERATION_ATTEMPTS && accepted.length < 2;
    attempt++
  ) {
    const prompt = buildSearchQueryGenerationPrompt(jobAnalysis, previousQueries);
    const rawResponse = await provider.generateText(prompt, {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.5,
      jsonMode: true,
    });
    const result = parseJsonResponse(
      rawResponse,
      searchQueryGenerationSchema,
      "search-query-generation",
    );
    lastRawQueries = result.search_queries;

    for (const query of result.search_queries) {
      const normalized = normalizeQueryForDedup(query);
      if (seenNormalized.has(normalized)) continue;
      seenNormalized.add(normalized);
      accepted.push(query);
    }
  }

  return accepted.length > 0 ? accepted : lastRawQueries;
}
