export interface GenerateTextOptions {
  systemInstruction?: string;
  temperature?: number;
  /**
   * Hints to the provider that the response should be raw JSON (no markdown
   * fences, no prose). Providers that support a native JSON mode (e.g.
   * OpenAI's response_format) should use it; others may ignore this hint,
   * so callers must still validate/parse the returned text defensively.
   */
  jsonMode?: boolean;
}

export interface AIProvider {
  generateText(
    prompt: string,
    options?: GenerateTextOptions,
  ): Promise<string>;
}

export class AIProviderError extends Error {
  constructor(provider: string, cause?: unknown) {
    super(`AI provider "${provider}" failed to generate a response.`);
    this.name = "AIProviderError";
    this.cause = cause;
  }
}

/**
 * Thrown when an AI response is not valid JSON, or doesn't match the
 * expected schema. Never let malformed AI output propagate as if it were
 * trustworthy structured data.
 */
export class AIResponseValidationError extends Error {
  constructor(context: string, cause?: unknown) {
    super(`AI response for "${context}" was not valid JSON matching the expected schema.`);
    this.name = "AIResponseValidationError";
    this.cause = cause;
  }
}
