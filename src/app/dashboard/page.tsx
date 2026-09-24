import { Briefcase, Plus, UserCheck, Target, Users, Activity } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/dashboard/nav";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ScoreDistributionChart } from "@/components/dashboard/score-distribution-chart";
import { SourcingTable } from "@/components/dashboard/sourcing-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    totalJobs,
    totalCandidates,
    shortlistedCandidates,
    averageMatchQuality,
    pipelineCounts,
    unifiedRows,
    matchScores,
    loadError,
  } = await getDashboardData(supabase, user.id);

  return (
    <main className="min-h-screen bg-slate-50/70 pb-16">
      <DashboardNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Welcome & Action Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30 mb-3">
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
            icon={UserCheck}
            tone="amber"
          />
          <StatCard
            label="Average Match Quality"
            value={averageMatchQuality !== null ? `${averageMatchQuality}%` : "No evaluated files yet"}
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
                {averageMatchQuality !== null && (
                  <Badge tone="good">
                    {averageMatchQuality}% avg
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ScoreDistributionChart scores={matchScores} />
            </CardContent>
          </Card>
        </div>

        {/* Sourcing Files */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Briefcase className="h-4 w-4 text-indigo-600" />
                Sourcing Files
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Every job requisition and its sourcing run, in one place
              </CardDescription>
            </div>
            <Button asChild size="sm">
              <Link href="/jobs/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New Job
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            <SourcingTable rows={unifiedRows} />
          </CardContent>
        </Card>

      </div>
    </main>
  );
}


