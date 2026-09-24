import { z } from "zod";

import type { AIProvider } from "@/lib/ai/AIProvider";
import { parseJsonResponse } from "@/lib/ai/parseJsonResponse";

export const locationVerificationSchema = z.object({
  in_egypt: z.boolean().nullable(),
  evidence: z.string(),
});

export type LocationVerificationResult = z.infer<typeof locationVerificationSchema>;

const SYSTEM_INSTRUCTION = `You are verifying whether a sourced candidate is genuinely based in Egypt, using ONLY the text provided. Never infer a country from a name, ethnicity, language, or the recruiting company's location. Respond only from an explicit or clearly implied location in the given text. If the text gives no such signal, respond null — never guess. Respond with raw JSON only. Do not wrap the JSON in markdown code fences.`;

export interface LocationVerificationInput {
  headline: string | null;
  summary: string | null;
  currentCompany: string | null;
}

export function buildLocationVerificationPrompt(input: LocationVerificationInput): string {
  return `Candidate headline: ${input.headline ?? "(unknown)"}
Candidate summary: ${input.summary ?? "(unknown)"}
Candidate current company: ${input.currentCompany ?? "(unknown)"}

Determine whether this candidate is currently based in Egypt, using only the text above. Respond as JSON matching exactly this shape:
{ "in_egypt": true | false | null, "evidence": string }
- true: an Egyptian city, governorate, or 'Egypt' is explicitly stated or unambiguous from the text.
- false: a city or country outside Egypt is explicitly stated.
- null: there is not enough information — do not guess.`;
}

/**
 * AI fallback tier for Egypt location verification, only meant to be called
 * when a candidate's location field is missing entirely (see
 * verifyEgyptLocation.ts's deterministic first tier, which handles the case
 * where a location string is present). Skips the AI call entirely when
 * there's no text at all to read — that's guaranteed to come back null, so
 * spending a request on it would be pure waste.
 */
export async function verifyEgyptLocationWithAI(
  input: LocationVerificationInput,
  provider: AIProvider,
): Promise<LocationVerificationResult> {
  if (!input.headline && !input.summary && !input.currentCompany) {
    return { in_egypt: null, evidence: "" };
  }

  const prompt = buildLocationVerificationPrompt(input);
  const rawResponse = await provider.generateText(prompt, {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0,
    jsonMode: true,
  });

  return parseJsonResponse(rawResponse, locationVerificationSchema, "location-verification");
}
