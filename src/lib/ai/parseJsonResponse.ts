import type { z } from "zod";

import { AIResponseValidationError } from "@/lib/ai/AIProvider";

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch?.[1] ?? trimmed;
}

export function parseJsonResponse<T>(
  rawText: string,
  schema: z.ZodType<T>,
  context: string,
): T {
  const cleaned = stripMarkdownFences(rawText);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (error) {
    throw new AIResponseValidationError(context, error);
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    throw new AIResponseValidationError(context, result.error);
  }

  return result.data;
}
