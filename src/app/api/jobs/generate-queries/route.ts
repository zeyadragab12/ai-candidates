import { NextResponse } from "next/server";

import { getAIProvider } from "@/lib/ai";
import { generateSearchQueries } from "@/lib/ai/prompts/search-query-generation";
import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { jobAnalysisSchema } from "@/types/job-analysis";

export const POST = withErrorHandling(async (request: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  await enforceRateLimit(
    `ai:${auth.user.id}`,
    RATE_LIMITS.aiRequest.limit,
    RATE_LIMITS.aiRequest.windowSeconds,
  );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = jobAnalysisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid job analysis data." },
      { status: 400 },
    );
  }

  const provider = getAIProvider();
  const queries = await generateSearchQueries(parsed.data, provider);
  return NextResponse.json({ search_queries: queries });
});
