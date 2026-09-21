import { Briefcase, Plus, Star, Target, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/dashboard/nav";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ScoreDistributionChart } from "@/components/dashboard/score-distribution-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface RecentJob {
  id: string;
  title: string;
  created_at: string;
}

interface RecentSearchRun {
  id: string;
  status: string;
  candidates_found: number | null;
  created_at: string;
  jobs: { title: string } | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    jobsCountRes,
    candidatesCountRes,
    shortlistedCountRes,
    matchScoresRes,
    candidateStatusesRes,
    recentJobsRes,
    recentRunsRes,
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }),
    supabase.from("candidates").select("*", { count: "exact", head: true }),
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("status", "Shortlisted"),
    supabase.from("candidate_matches").select("match_score"),
    supabase.from("candidates").select("status"),
    supabase
      .from("jobs")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("search_runs")
      .select("id, status, candidates_found, created_at, jobs(title)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const loadError =
    jobsCountRes.error ||
    candidatesCountRes.error ||
    shortlistedCountRes.error ||
    matchScoresRes.error ||
    candidateStatusesRes.error ||
    recentJobsRes.error ||
    recentRunsRes.error
      ? "Some dashboard data failed to load. Try refreshing the page."
      : null;

  const totalJobs = jobsCountRes.count ?? 0;
  const totalCandidates = candidatesCountRes.count ?? 0;
  const shortlistedCandidates = shortlistedCountRes.count ?? 0;

  const matchScores = (matchScoresRes.data ?? []).map(
    (row: { match_score: number }) => row.match_score,
  );
  const averageMatchScore =
    matchScores.length > 0
      ? Math.round(
          matchScores.reduce((sum: number, score: number) => sum + score, 0) /
            matchScores.length,
        )
      : null;

  const pipelineCounts = (candidateStatusesRes.data ?? []).reduce<Record<string, number>>(
    (acc, row: { status: string }) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const recentJobs = (recentJobsRes.data ?? []) as RecentJob[];
  const recentRuns = (recentRunsRes.data ?? []) as unknown as RecentSearchRun[];

  return (
    <main className="min-h-screen">
      <DashboardNav />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A snapshot of your hiring pipeline.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/jobs/new">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New Job
            </Link>
          </Button>
        </div>

        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Jobs" value={totalJobs} icon={Briefcase} tone="indigo" />
          <StatCard label="Total Candidates" value={totalCandidates} icon={Users} tone="sky" />
          <StatCard
            label="Shortlisted Candidates"
            value={shortlistedCandidates}
            icon={Star}
            tone="amber"
          />
          <StatCard
            label="Average Match Score"
            value={averageMatchScore !== null ? `${averageMatchScore}%` : "—"}
            icon={Target}
            tone="emerald"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Candidate Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineChart counts={pipelineCounts} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Match Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreDistributionChart scores={matchScores} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No jobs yet.{" "}
                  <Link href="/jobs/new" className="underline">
                    Create your first job
                  </Link>{" "}
                  to get started.
                </p>
              ) : (
                <ul className="flex flex-col gap-2" data-testid="recent-jobs-list">
                  {recentJobs.map((job) => (
                    <li key={job.id} className="flex items-center justify-between text-sm">
                      <Link
                        href={`/candidates?jobId=${job.id}`}
                        className="text-primary underline"
                      >
                        {job.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Recent Search Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No search runs yet.</p>
              ) : (
                <ul className="flex flex-col gap-2" data-testid="recent-search-runs-list">
                  {recentRuns.map((run) => (
                    <li key={run.id} className="text-sm">
                      <span className="font-medium">{run.jobs?.title ?? "Unknown job"}</span>
                      {" — "}
                      <span className="capitalize">{run.status}</span>
                      {run.status === "complete" && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({run.candidates_found ?? 0} candidates)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
