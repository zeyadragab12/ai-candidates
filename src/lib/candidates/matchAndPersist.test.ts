import { describe, expect, it, vi } from "vitest";

import { matchAndPersistCandidate } from "./matchAndPersist";
import type { AIProvider } from "@/lib/ai/AIProvider";
import type { MatchingCandidateInput, MatchingJobInput } from "@/types/matching";

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

const CANDIDATE: MatchingCandidateInput = {
  name: "Amina",
  headline: "React Developer",
  company: "Acme",
  location: "Cairo",
  skills: ["React"],
  experience_years: 5,
  summary: null,
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
  strengths: ["Strong React skills"],
  concerns: [],
  summary: "Good match.",
});

function makeProvider(response: string): AIProvider {
  return {
    generateText: vi.fn().mockResolvedValue(response),
  };
}

function makeFakeSupabase() {
  const upsert = vi.fn().mockReturnValue({
    select() {
      return {
        async single() {
          return { data: { id: "match-1", match_score: 80 }, error: null };
        },
      };
    },
  });
  return {
    from: vi.fn().mockReturnValue({ upsert }),
    _upsert: upsert,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("matchAndPersistCandidate", () => {
  it("persists a valid match result", async () => {
    const supabase = makeFakeSupabase();
    const provider = makeProvider(VALID_MATCH_JSON);

    const result = await matchAndPersistCandidate(
      supabase,
      provider,
      "job-1",
      JOB,
      "candidate-1",
      CANDIDATE,
      null,
    );

    expect(result.success).toBe(true);
    expect(supabase._upsert).toHaveBeenCalledOnce();
  });

  it("maps the AI response's 'summary' field to the DB's 'ai_summary' column, not a literal 'summary' column", async () => {
    const supabase = makeFakeSupabase();
    const provider = makeProvider(VALID_MATCH_JSON);

    await matchAndPersistCandidate(supabase, provider, "job-1", JOB, "candidate-1", CANDIDATE, null);

    const [upsertedRow] = supabase._upsert.mock.calls[0];
    expect(upsertedRow.ai_summary).toBe("Good match.");
    expect(upsertedRow.summary).toBeUndefined();
  });

  it("never persists when the AI returns malformed JSON (caught by Zod)", async () => {
    const supabase = makeFakeSupabase();
    const provider = makeProvider("this is not valid json");

    const result = await matchAndPersistCandidate(
      supabase,
      provider,
      "job-1",
      JOB,
      "candidate-1",
      CANDIDATE,
      null,
    );

    expect(result.success).toBe(false);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it("never persists when the AI returns valid JSON that fails schema validation", async () => {
    const supabase = makeFakeSupabase();
    // match_score out of range, missing several required fields
    const provider = makeProvider(JSON.stringify({ match_score: 999 }));

    const result = await matchAndPersistCandidate(
      supabase,
      provider,
      "job-1",
      JOB,
      "candidate-1",
      CANDIDATE,
      null,
    );

    expect(result.success).toBe(false);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it("returns a failure (not a throw) when the AI provider itself errors", async () => {
    const supabase = makeFakeSupabase();
    const provider: AIProvider = {
      generateText: vi.fn().mockRejectedValue(new Error("network down")),
    };

    const result = await matchAndPersistCandidate(
      supabase,
      provider,
      "job-1",
      JOB,
      "candidate-1",
      CANDIDATE,
      null,
    );

    expect(result.success).toBe(false);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it("reports failure (not a throw) when the DB write itself fails", async () => {
    const provider = makeProvider(VALID_MATCH_JSON);
    const supabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select() {
            return {
              async single() {
                return { data: null, error: { message: "db error" } };
              },
            };
          },
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await matchAndPersistCandidate(
      supabase,
      provider,
      "job-1",
      JOB,
      "candidate-1",
      CANDIDATE,
      null,
    );

    expect(result.success).toBe(false);
  });
});
