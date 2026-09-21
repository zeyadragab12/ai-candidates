import { env } from "@/lib/env";
import { OpenAIProvider } from "@/lib/ai/OpenAIProvider";
import type { AIProvider } from "@/lib/ai/AIProvider";

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not set. AI features require an OpenAI API key.",
      );
    }
    cachedProvider = env.OPENAI_MODEL
      ? new OpenAIProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL)
      : new OpenAIProvider(env.OPENAI_API_KEY);
  }
  return cachedProvider;
}

export type { AIProvider } from "@/lib/ai/AIProvider";
