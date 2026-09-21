import {
  Briefcase,
  Plus,
  Star,
  Target,
  Users,
  Activity,
  FileText,
  Search,
  Sparkles,
  ArrowRight,
} from "lucide-react";
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
  CardDescription,
} from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
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

function getRunTone(status: string): BadgeTone {
  if (status === "complete") return "good";
  if (status === "running" || status === "pending") return "warning";
  if (status === "error") return "critical";
  return "neutral";
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
    <main className="min-h-screen bg-slate-50/70 pb-16">
      <DashboardNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Welcome & Action Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30 mb-3">
                <Sparkles className="h-3.5 w-3.5" />
                AI-Powered Recruitment Pipeline
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Candidate Sourcing Hub
              </h1>
              <p className="mt-2 text-base text-slate-300 leading-relaxed">
                Transform job descriptions into structured requirements, discover passive talent legally across authorized sources, and evaluate match quality instantly with AI.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 font-medium">
                <Link href="/jobs/new">
                  <Plus className="mr-2 h-5 w-5" aria-hidden="true" />
                  New Job Opening
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                <Link href="/candidates">
                  <Users className="mr-2 h-4 w-4" />
                  Browse Candidates
                </Link>
              </Button>
            </div>
          </div>
          {/* Subtle background glow */}
          <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        </div>

        {/* Quick Sourcing Workflow Guide */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-semibold text-sm">
              1
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Upload Job Spec</p>
              <p className="text-xs text-slate-500 mt-0.5">Paste text or upload PDF/DOCX to extract key skills.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 font-semibold text-sm">
              2
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">AI Criteria Extraction</p>
              <p className="text-xs text-slate-500 mt-0.5">Review, customize and refine extracted requirements.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-semibold text-sm">
              3
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Autonomous Sourcing</p>
              <p className="text-xs text-slate-500 mt-0.5">Automated queries search authorized providers.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-semibold text-sm">
              4
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">AI Scoring & Excel</p>
              <p className="text-xs text-slate-500 mt-0.5">Multi-factor match breakdown and instant export.</p>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200 shadow-sm flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <p role="alert" className="text-sm font-medium text-red-800">
              {loadError}
            </p>
          </div>
        )}

        {/* Core Metrics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active Jobs" value={totalJobs} icon={Briefcase} tone="indigo" />
          <StatCard label="Total Candidates" value={totalCandidates} icon={Users} tone="sky" />
          <StatCard
            label="Shortlisted Talent"
            value={shortlistedCandidates}
            icon={Star}
            tone="amber"
          />
          <StatCard
            label="Average Match Quality"
            value={averageMatchScore !== null ? `${averageMatchScore}%` : "—"}
            icon={Target}
            tone="emerald"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Activity className="h-4 w-4 text-indigo-600" />
                    Candidate Pipeline Stages
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Real-time status breakdown across all active sourcing jobs
                  </CardDescription>
                </div>
                <Badge tone="neutral">
                  {totalCandidates} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <PipelineChart counts={pipelineCounts} />
            </CardContent>
          </Card>

          <Card className="col-span-1 shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Match Score Distribution
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    AI evaluation scores (0–100%)
                  </CardDescription>
                </div>
                {averageMatchScore !== null && (
                  <Badge tone="good">
                    {averageMatchScore}% avg
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ScoreDistributionChart scores={matchScores} />
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Management */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          {/* Recent Jobs */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Recent Job Requisitions
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Latest roles currently being sourced
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                <Link href="/jobs">
                  View All
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {recentJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">No jobs posted yet</p>
                  <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
                    Upload your first job description to initiate AI sourcing and matching.
                  </p>
                  <Button size="sm" asChild>
                    <Link href="/jobs/new">
                      <Plus className="mr-1.5 h-4 w-4" />
                      Create Job
                    </Link>
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100" data-testid="recent-jobs-list">
                  {recentJobs.map((job) => (
                    <li key={job.id} className="flex items-center justify-between py-3 group">
                      <div className="min-w-0 flex-1 pr-4">
                        <Link
                          href={`/candidates?jobId=${job.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600 transition-colors truncate block"
                        >
                          {job.title}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Created on {new Date(job.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild className="h-8 text-xs font-normal">
                          <Link href={`/candidates?jobId=${job.id}`}>
                            Candidates
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent Search Runs */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <Search className="h-4 w-4 text-indigo-600" />
                  Recent Sourcing Runs
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Autonomous queries and public candidate discovery
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {recentRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <Search className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">No searches executed yet</p>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    When you click &quot;Find Candidates&quot; on any job, background sourcing runs will show up here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100" data-testid="recent-search-runs-list">
                  {recentRuns.map((run) => (
                    <li key={run.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0 flex-1 pr-4">
                        <span className="font-medium text-slate-900 block truncate">
                          {run.jobs?.title ?? "Untitled Role"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(run.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {run.status === "complete" && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {run.candidates_found ?? 0} candidates
                          </span>
                        )}
                        <Badge tone={getRunTone(run.status)} className="capitalize">
                          {run.status}
                        </Badge>
                      </div>
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


