import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import {
  filterCandidates,
  sortCandidates,
  type CandidateForFiltering,
  type CandidateSortField,
} from "@/lib/candidates/filterAndSort";
import { buildCandidatesWorkbook, workbookToBuffer, type CandidateExportRow } from "@/lib/export/excel";
import { withErrorHandling } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CandidateRow extends CandidateForFiltering {
  headline: string | null;
  profile_url: string | null;
  status: string;
  match: {
    match_score: number;
    skills_score: number | null;
    experience_score: number | null;
    location_score: number | null;
    education_score: number | null;
    seniority_score: number | null;
    matched_requirements: string[];
    missing_requirements: string[];
    ai_summary: string | null;
  } | null;
}

const SORT_FIELDS: CandidateSortField[] = [
  "name",
  "experience_years",
  "match_score",
  "created_at",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const GET = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id: jobId } = await params;

  await enforceRateLimit(
    `export:${auth.user.id}`,
    RATE_LIMITS.export.limit,
    RATE_LIMITS.export.windowSeconds,
  );

  const job = await supabase
    .from("jobs")
    .select("id, title")
    .eq("id", jobId)
    .maybeSingle();

  if (job.error) {
    return NextResponse.json({ error: "Failed to load job." }, { status: 500 });
  }
  if (!job.data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
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
    status: searchParams.get("status") ?? undefined,
  };

  const { data: linked, error: linkError } = await supabase
    .from("job_candidates")
    .select("candidate_id, candidates(*)")
    .eq("job_id", jobId);

  if (linkError) {
    return NextResponse.json(
      { error: "Failed to load candidates for this job." },
      { status: 500 },
    );
  }

  const candidateIds = (linked ?? []).map((row) => row.candidate_id);

  const [matchesResult, notesResult] = await Promise.all([
    candidateIds.length
      ? supabase
          .from("candidate_matches")
          .select("*")
          .eq("job_id", jobId)
          .in("candidate_id", candidateIds)
      : Promise.resolve({ data: [], error: null }),
    candidateIds.length
      ? supabase
          .from("candidate_notes")
          .select("candidate_id, note")
          .in("candidate_id", candidateIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (matchesResult.error) {
    return NextResponse.json(
      { error: "Failed to load match data for this job." },
      { status: 500 },
    );
  }
  if (notesResult.error) {
    return NextResponse.json(
      { error: "Failed to load notes for this job." },
      { status: 500 },
    );
  }

  const matchByCandidateId = new Map(
    (matchesResult.data ?? []).map((match) => [match.candidate_id, match]),
  );

  const notesByCandidateId = new Map<string, string[]>();
  for (const note of notesResult.data ?? []) {
    const existing = notesByCandidateId.get(note.candidate_id) ?? [];
    existing.push(note.note);
    notesByCandidateId.set(note.candidate_id, existing);
  }

  const merged: CandidateRow[] = (linked ?? []).map((row) => ({
    ...(row.candidates as unknown as CandidateRow),
    match: matchByCandidateId.get(row.candidate_id) ?? null,
  }));

  const filtered = filterCandidates(merged, filters);
  const sorted = sortCandidates(filtered, sortBy, sortDir);

  const exportRows: CandidateExportRow[] = sorted.map((candidate) => ({
    name: candidate.name,
    headline: candidate.headline,
    company: candidate.company,
    location: candidate.location,
    experience_years: candidate.experience_years,
    skills: candidate.skills,
    match_score: candidate.match?.match_score ?? null,
    skills_score: candidate.match?.skills_score ?? null,
    experience_score: candidate.match?.experience_score ?? null,
    location_score: candidate.match?.location_score ?? null,
    education_score: candidate.match?.education_score ?? null,
    seniority_score: candidate.match?.seniority_score ?? null,
    matched_requirements: candidate.match?.matched_requirements ?? [],
    missing_requirements: candidate.match?.missing_requirements ?? [],
    ai_summary: candidate.match?.ai_summary ?? null,
    source: candidate.source,
    profile_url: candidate.profile_url,
    status: candidate.status,
    notes: notesByCandidateId.get(candidate.id) ?? [],
    created_at: candidate.created_at,
  }));

  const workbook = buildCandidatesWorkbook(exportRows);
  const buffer = workbookToBuffer(workbook);

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `candidates-${slugify(job.data.title)}-${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
