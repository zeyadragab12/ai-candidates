import type { SupabaseClient } from "@supabase/supabase-js";

import { getDisplayName } from "@/lib/users/displayName";

export interface UnifiedSourcingRow {
  runId: string;
  jobId: string;
  jobTitle: string;
  sourcingStatus: string;
  totalCandidates: number;
  shortlistedCandidates: number;
  unseenCandidates: number;
  fileCreatedBy: string | null;
  lastAccessedBy: string | null;
  lastActivityTime: string | null;
  createdAt: string;
}

export interface TodaysCandidateRow {
  id: string;
  name: string | null;
  headline: string | null;
  source: string;
  jobTitle: string | null;
  createdAt: string;
}

export interface DashboardData {
  totalJobs: number;
  totalCandidates: number;
  shortlistedCandidates: number;
  averageMatchQuality: number | null;
  pipelineCounts: Record<string, number>;
  unifiedRows: UnifiedSourcingRow[];
  matchScores: number[];
  todaysCandidatesCount: number;
  todaysCandidates: TodaysCandidateRow[];
  loadError: string | null;
}

interface SearchRunRow {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by_email: string | null;
  jobs: { title: string } | null;
}

interface JobCandidateRow {
  job_id: string;
  candidate_id: string;
  search_run_id: string | null;
  candidates: { status: string } | null;
}

interface CandidateMatchRow {
  search_run_id: string | null;
  match_score: number;
}

interface SearchRunAccessRow {
  search_run_id: string;
  user_email: string;
  accessed_at: string;
}

/**
 * Groups per-file (= search run) evaluated match scores and averages them,
 * then averages those per-file averages — so a file with 100 evaluated
 * candidates counts the same as one with 20, per the dashboard spec. Files
 * (runs) with zero evaluated candidates are excluded entirely rather than
 * treated as 0%.
 */
function computeAverageMatchQuality(matches: CandidateMatchRow[]): number | null {
  const scoresByRun = new Map<string, number[]>();
  for (const match of matches) {
    if (!match.search_run_id) continue;
    const scores = scoresByRun.get(match.search_run_id) ?? [];
    scores.push(match.match_score);
    scoresByRun.set(match.search_run_id, scores);
  }

  const fileAverages = Array.from(scoresByRun.values())
    .filter((scores) => scores.length > 0)
    .map((scores) => scores.reduce((sum, s) => sum + s, 0) / scores.length);

  if (fileAverages.length === 0) return null;
  return Math.round(
    fileAverages.reduce((sum, avg) => sum + avg, 0) / fileAverages.length,
  );
}

export async function getDashboardData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  currentUserId: string,
): Promise<DashboardData> {
  const startOfTodayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [
    jobsCountRes,
    candidatesCountRes,
    shortlistedCountRes,
    matchScoresRes,
    candidateStatusesRes,
    searchRunsRes,
    jobCandidatesRes,
    candidateViewsRes,
    searchRunAccessRes,
    todaysCandidatesCountRes,
    todaysCandidatesRes,
  ] = await Promise.all([
    // This is the personal dashboard for every role, so every query is
    // scoped to the current user's own work. Team and org views live at
    // /manager and /admin; RLS alone would widen this for those roles.
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", currentUserId),
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("user_id", currentUserId),
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("user_id", currentUserId)
      .eq("status", "Shortlisted"),
    supabase
      .from("candidate_matches")
      .select("match_score, search_run_id, jobs!inner(user_id)")
      .eq("jobs.user_id", currentUserId),
    supabase.from("candidates").select("status").eq("user_id", currentUserId),
    supabase
      .from("search_runs")
      .select(
        "id, job_id, status, created_at, started_at, completed_at, created_by_email, jobs!inner(title, user_id)",
      )
      .eq("jobs.user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("job_candidates")
      .select("job_id, candidate_id, search_run_id, candidates(status), jobs!inner(user_id)")
      .eq("jobs.user_id", currentUserId),
    supabase.from("candidate_views").select("candidate_id, job_id").eq("user_id", currentUserId),
    supabase
      .from("search_run_access")
      .select("search_run_id, user_email, accessed_at")
      .order("accessed_at", { ascending: false }),
    // Today's sourced candidates, scoped to the logged-in user (candidates
    // are owned by user_id, same scoping every other candidate query in
    // this app uses).
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("user_id", currentUserId)
      .gte("created_at", startOfTodayIso),
    supabase
      .from("candidates")
      .select("id, name, headline, source, created_at, job_candidates(job_id, jobs(title))")
      .eq("user_id", currentUserId)
      .gte("created_at", startOfTodayIso)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const loadError =
    jobsCountRes.error ||
    candidatesCountRes.error ||
    shortlistedCountRes.error ||
    matchScoresRes.error ||
    candidateStatusesRes.error ||
    searchRunsRes.error ||
    jobCandidatesRes.error ||
    todaysCandidatesCountRes.error ||
    todaysCandidatesRes.error
      ? "Some dashboard data failed to load. Try refreshing the page."
      : null;

  const totalJobs = jobsCountRes.count ?? 0;
  const totalCandidates = candidatesCountRes.count ?? 0;
  const shortlistedCandidates = shortlistedCountRes.count ?? 0;

  const matches = (matchScoresRes.data ?? []) as CandidateMatchRow[];
  const matchScores = matches.map((m) => m.match_score);
  const averageMatchQuality = computeAverageMatchQuality(matches);

  const pipelineCounts = (candidateStatusesRes.data ?? []).reduce<Record<string, number>>(
    (acc, row: { status: string }) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const searchRuns = (searchRunsRes.data ?? []) as unknown as SearchRunRow[];
  const jobCandidates = (jobCandidatesRes.data ?? []) as unknown as JobCandidateRow[];
  const viewedKeys = new Set(
    (candidateViewsRes.data ?? []).map(
      (v: { candidate_id: string; job_id: string }) => `${v.job_id}:${v.candidate_id}`,
    ),
  );
  const accessRows = (searchRunAccessRes.data ?? []) as SearchRunAccessRow[];
  const latestAccessByRun = new Map<string, SearchRunAccessRow>();
  for (const row of accessRows) {
    if (!latestAccessByRun.has(row.search_run_id)) {
      latestAccessByRun.set(row.search_run_id, row);
    }
  }

  const candidatesByRun = new Map<string, JobCandidateRow[]>();
  for (const row of jobCandidates) {
    if (!row.search_run_id) continue;
    const list = candidatesByRun.get(row.search_run_id) ?? [];
    list.push(row);
    candidatesByRun.set(row.search_run_id, list);
  }

  const unifiedRows: UnifiedSourcingRow[] = searchRuns.map((run) => {
    const linked = candidatesByRun.get(run.id) ?? [];
    const shortlisted = linked.filter((row) => row.candidates?.status === "Shortlisted").length;
    const unseen = linked.filter(
      (row) => !viewedKeys.has(`${row.job_id}:${row.candidate_id}`),
    ).length;
    const lastAccess = latestAccessByRun.get(run.id) ?? null;

    const activityTimestamps = [run.completed_at, run.started_at, run.created_at, lastAccess?.accessed_at]
      .filter((v): v is string => !!v)
      .map((v) => new Date(v).getTime());
    const lastActivityTime =
      activityTimestamps.length > 0
        ? new Date(Math.max(...activityTimestamps)).toISOString()
        : null;

    return {
      runId: run.id,
      jobId: run.job_id,
      jobTitle: run.jobs?.title ?? "Untitled Role",
      sourcingStatus: run.status,
      totalCandidates: linked.length,
      shortlistedCandidates: shortlisted,
      unseenCandidates: unseen,
      fileCreatedBy: getDisplayName(run.created_by_email),
      lastAccessedBy: lastAccess ? getDisplayName(lastAccess.user_email) : null,
      lastActivityTime,
      createdAt: run.created_at,
    };
  });

  interface TodaysCandidateQueryRow {
    id: string;
    name: string | null;
    headline: string | null;
    source: string;
    created_at: string;
    job_candidates: { job_id: string; jobs: { title: string } | null }[] | null;
  }

  const todaysCandidates: TodaysCandidateRow[] = (
    (todaysCandidatesRes.data ?? []) as unknown as TodaysCandidateQueryRow[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    headline: row.headline,
    source: row.source,
    jobTitle: row.job_candidates?.[0]?.jobs?.title ?? null,
    createdAt: row.created_at,
  }));

  return {
    totalJobs,
    totalCandidates,
    shortlistedCandidates,
    averageMatchQuality,
    pipelineCounts,
    unifiedRows,
    matchScores,
    todaysCandidatesCount: todaysCandidatesCountRes.count ?? 0,
    todaysCandidates,
    loadError,
  };
}
