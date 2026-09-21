import { describe, expect, it, vi } from "vitest";

import { runBatchMatch, type BatchMatchCandidate } from "./batchMatch";
import type { AIProvider } from "@/lib/ai/AIProvider";
import type { MatchingJobInput } from "@/types/matching";

const JOB: MatchingJobInput = {
  job_title: "Frontend Developer",
  seniority: "Mid",
  location: "Cairo",
  required_skills: ["React"],
  preferred_skills: [],
  years_of_experience: { minimum: 3, maximum: null },
  education: [],
  certifications: [],
  industries: [],
  responsibilities: [],
};

const VALID_MATCH_JSON = JSON.stringify({
  match_score: 80,
  skills_score: 90,
  experience_score: 100,
  location_score: 100,
  education_score: 50,
  seniority_score: 80,
  matched_requirements: ["React"],
  missing_requirements: [],
  strengths: [],
  concerns: [],
  summary: "Good match.",
});

function makeFakeSupabase() {
  const upsertedRows: unknown[] = [];
  return {
    from: () => ({
      upsert: (row: unknown) => {
        upsertedRows.push(row);
        return {
          select: () => ({
            async single() {
              return { data: { id: `match-${upsertedRows.length}`, ...row as object }, error: null };
            },
          }),
        };
      },
    }),
    _upsertedRows: upsertedRows,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeCandidates(count: number): BatchMatchCandidate[] {
  return Array.from({ length: count }, (_, i) => ({
    candidateId: `candidate-${i}`,
    input: {
      name: `Candidate ${i}`,
      headline: "React Developer",
      company: "Acme",
      location: "Cairo",
      skills: ["React"],
      experience_years: 5,
      summary: null,
    },
  }));
}

describe("runBatchMatch", () => {
  it("matches all candidates successfully when the AI succeeds for everyone", async () => {
    const supabase = makeFakeSupabase();
    const provider: AIProvider = { generateText: vi.fn().mockResolvedValue(VALID_MATCH_JSON) };

    const summary = await runBatchMatch(supabase, provider, "job-1", JOB, makeCandidates(10));

    expect(summary.total).toBe(10);
    expect(summary.succeeded).toBe(10);
    expect(summary.failed).toBe(0);
    expect(supabase._upsertedRows).toHaveLength(10);
  });

  it("one candidate's AI error does not block the other 9 from being matched and persisted", async () => {
    const supabase = makeFakeSupabase();
    const candidates = makeCandidates(10);
    const failingCandidateId = candidates[4]?.candidateId;

    const provider: AIProvider = {
      generateText: vi.fn().mockImplementation(async (prompt: string) => {
        if (prompt.includes("Candidate 4")) {
          throw new Error("simulated transient AI failure");
        }
        return VALID_MATCH_JSON;
      }),
    };

    const summary = await runBatchMatch(supabase, provider, "job-1", JOB, candidates);

    expect(summary.total).toBe(10);
    expect(summary.succeeded).toBe(9);
    expect(summary.failed).toBe(1);
    expect(supabase._upsertedRows).toHaveLength(9);

    const failedResult = summary.results.find((r) => r.candidateId === failingCandidateId);
    expect(failedResult?.success).toBe(false);

    const otherResults = summary.results.filter((r) => r.candidateId !== failingCandidateId);
    expect(otherResults.every((r) => r.success)).toBe(true);
  });

  it("one candidate's malformed AI output does not block the others", async () => {
    const supabase = makeFakeSupabase();
    const candidates = makeCandidates(5);

    const provider: AIProvider = {
      generateText: vi.fn().mockImplementation(async (prompt: string) => {
        if (prompt.includes("Candidate 2")) {
          return "not valid json at all";
        }
        return VALID_MATCH_JSON;
      }),
    };

    const summary = await runBatchMatch(supabase, provider, "job-1", JOB, candidates);

    expect(summary.succeeded).toBe(4);
    expect(summary.failed).toBe(1);
  });

  it("returns an empty summary for an empty candidate list", async () => {
    const supabase = makeFakeSupabase();
    const provider: AIProvider = { generateText: vi.fn() };

    const summary = await runBatchMatch(supabase, provider, "job-1", JOB, []);

    expect(summary).toEqual({ total: 0, succeeded: 0, failed: 0, results: [] });
  });

  it("never runs more than 3 AI calls concurrently (real Gemini free-tier rate limit hit at 10 concurrent)", async () => {
    const supabase = makeFakeSupabase();
    let activeCalls = 0;
    let maxObservedConcurrency = 0;

    const provider: AIProvider = {
      generateText: vi.fn().mockImplementation(async () => {
        activeCalls += 1;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeCalls);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeCalls -= 1;
        return VALID_MATCH_JSON;
      }),
    };

    await runBatchMatch(supabase, provider, "job-1", JOB, makeCandidates(10));

    expect(maxObservedConcurrency).toBeLessThanOrEqual(3);
  });
});
