import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import {
  filterCandidates,
  sortCandidates,
  type CandidateForFiltering,
  type CandidateSortField,
} from "@/lib/candidates/filterAndSort";
import { withErrorHandling } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SORT_FIELDS: CandidateSortField[] = [
  "name",
  "experience_years",
  "match_score",
  "created_at",
];

function parseNumberParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const GET = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id: jobId } = await params;

  const [job, linkedResult] = await Promise.all([
    supabase.from("jobs").select("id").eq("id", jobId).maybeSingle(),
    supabase
      .from("job_candidates")
      .select("candidate_id, candidates(*)")
      .eq("job_id", jobId),
  ]);

  if (job.error) {
    return NextResponse.json({ error: "Failed to load job." }, { status: 500 });
  }
  if (!job.data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const { data: linked, error: linkError } = linkedResult;
  if (linkError) {
    return NextResponse.json(
      { error: "Failed to load candidates for this job." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

  const sortByParam = searchParams.get("sort_by");
  const sortBy: CandidateSortField = SORT_FIELDS.includes(
    sortByParam as CandidateSortField,
  )
    ? (sortByParam as CandidateSortField)
    : "created_at";
  const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";

  const filters = {
    name: searchParams.get("name") ?? undefined,
    skill: searchParams.get("skill") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    company: searchParams.get("company") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    minExperience: parseNumberParam(searchParams.get("min_experience")),
    maxExperience: parseNumberParam(searchParams.get("max_experience")),
    minMatchScore: parseNumberParam(searchParams.get("min_match_score")),
    maxMatchScore: parseNumberParam(searchParams.get("max_match_score")),
  };

  // Fetched in full (not DB-paginated) so filtering/sorting/pagination stay
  // correct together. Fine at this app's realistic per-job candidate scale;
  // would need a different approach at very large volumes.
  const candidateIds = (linked ?? []).map((row) => row.candidate_id);

  const { data: matches, error: matchesError } = candidateIds.length
    ? await supabase
        .from("candidate_matches")
        .select("*")
        .eq("job_id", jobId)
        .in("candidate_id", candidateIds)
    : { data: [], error: null };

  if (matchesError) {
    return NextResponse.json(
      { error: "Failed to load match data for this job." },
      { status: 500 },
    );
  }

  const matchByCandidateId = new Map(
    (matches ?? []).map((match) => [match.candidate_id, match]),
  );

  const merged: CandidateForFiltering[] = (linked ?? []).map((row) => ({
    ...(row.candidates as unknown as CandidateForFiltering),
    match: matchByCandidateId.get(row.candidate_id) ?? null,
  }));

  const filtered = filterCandidates(merged, filters);
  const sorted = sortCandidates(filtered, sortBy, sortDir);

  const from = (page - 1) * limit;
  const paged = sorted.slice(from, from + limit);

  return NextResponse.json({
    candidates: paged,
    total: sorted.length,
    page,
    limit,
  });
});
