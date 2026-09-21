import OpenAI, { APIError } from "openai";

import {
  AIProviderError,
  type AIProvider,
  type GenerateTextOptions,
} from "@/lib/ai/AIProvider";
import { isRetryableStatus, withRetry } from "@/lib/retry";

// Cheapest general-purpose chat model available at the time this was
// written — verify current pricing/model IDs at
// https://platform.openai.com/docs/models before relying on this default
// for production volume; override via OPENAI_MODEL if it's since changed.
const DEFAULT_MODEL = "gpt-5.6-luna";

const RETRY_OPTIONS = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  // A non-APIError (network failure, empty-response Error thrown below) is
  // treated as transient too; an APIError is only retried for its
  // rate-limit/5xx statuses — a 400 (bad request) or 401 (bad key) won't
  // fix itself on retry.
  isRetryable: (error: unknown) =>
    !(error instanceof APIError) || isRetryableStatus(error.status),
};

export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateText(
    prompt: string,
    options?: GenerateTextOptions,
  ): Promise<string> {
    try {
      return await withRetry(async () => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          // `temperature` is deliberately never forwarded: gpt-5.6-luna (and
          // the rest of the GPT-5.x-class family) rejects any non-default
          // value with a 400 ("Only the default (1) value is supported"),
          // so honoring the interface's temperature hint would break every
          // structured-extraction call the app makes against this model.
          response_format: options?.jsonMode ? { type: "json_object" } : undefined,
          messages: [
            ...(options?.systemInstruction
              ? [{ role: "system" as const, content: options.systemInstruction }]
              : []),
            { role: "user" as const, content: prompt },
          ],
        });

        const text = response.choices[0]?.message?.content;
        if (!text) {
          throw new Error("OpenAI returned an empty response.");
        }
        return text;
      }, RETRY_OPTIONS);
    } catch (error) {
      throw new AIProviderError("openai", error);
    }
  }
}
