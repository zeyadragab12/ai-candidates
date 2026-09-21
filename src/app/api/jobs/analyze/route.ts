import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider } from "@/lib/ai";
import { analyzeJobDescription } from "@/lib/ai/prompts/job-analysis";
import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const requestSchema = z.object({
  jobDescriptionText: z
    .string({ message: "jobDescriptionText is required." })
    .trim()
    .min(50, "Job description is too short to analyze."),
});

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

  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: parsedRequest.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const provider = getAIProvider();
  const analysis = await analyzeJobDescription(
    parsedRequest.data.jobDescriptionText,
    provider,
  );
  return NextResponse.json(analysis);
});
