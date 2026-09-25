import {
  Activity,
  Briefcase,
  History,
  Loader,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";

import { ActivityFeed } from "@/components/admin/activity-feed";
import { CreateTeamForm } from "@/components/admin/create-team-form";
import { TeamsOverview } from "@/components/admin/teams-overview";
import { UserManagement } from "@/components/admin/user-management";
import { UserPerformanceTable } from "@/components/admin/user-performance-table";
import { DashboardNav } from "@/components/dashboard/nav";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminDashboardData } from "@/lib/admin/getAdminDashboardData";
import { getProfile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Every query below is also restricted by RLS; this check just keeps
  // non-admins from landing on an empty page.
  const profile = await getProfile(supabase, user.id);
  if (!profile || !profile.is_active || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const {
    totals,
    pipelineCounts,
    users,
    teams,
    teamOptions,
    managerOptions,
    recentActivity,
    loadError,
  } = await getAdminDashboardData(supabase);

  return (
    <main className="min-h-screen bg-slate-50/70 pb-16">
      <DashboardNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              System-wide view
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-base leading-relaxed text-slate-300">
              Organization-wide sourcing performance across {totals.teams}{" "}
              {totals.teams === 1 ? "team" : "teams"} and {totals.activeUsers} active{" "}
              {totals.activeUsers === 1 ? "user" : "users"}. Manage roles, teams, and managers
              below.
            </p>
          </div>
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        {loadError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <p role="alert" className="text-sm font-medium text-red-800">
              {loadError}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Users"
            value={`${totals.activeUsers} / ${totals.users}`}
            icon={Users}
            tone="indigo"
          />
          <StatCard label="Total Jobs" value={totals.jobs} icon={Briefcase} tone="sky" />
          <StatCard
            label="Average Match Quality"
            value={
              totals.averageMatchQuality !== null
                ? `${totals.averageMatchQuality}%`
                : "No evaluated files yet"
            }
            icon={Target}
            tone="emerald"
          />
          <StatCard
            label="Shortlisted Talent"
            value={totals.shortlisted}
            icon={UserCheck}
            tone="amber"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="col-span-1 border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Activity className="h-4 w-4 text-indigo-600" />
                    Organization Pipeline
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Candidate status breakdown across every team
                  </CardDescription>
                </div>
                <Badge tone="neutral">{totals.candidates} total</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <PipelineChart counts={pipelineCounts} />
            </CardContent>
          </Card>

          <Card className="col-span-1 border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Loader className="h-4 w-4 text-indigo-600" />
                Sourcing Runs
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Status of every sourcing run in the organization
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <dl className="flex flex-col divide-y divide-slate-100 text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-600">Running</dt>
                  <dd>
                    <Badge tone={totals.activeRuns > 0 ? "warning" : "neutral"}>
                      {totals.activeRuns}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-600">Completed</dt>
                  <dd>
                    <Badge tone="good">{totals.completedRuns}</Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-600">Failed</dt>
                  <dd>
                    <Badge tone={totals.failedRuns > 0 ? "critical" : "neutral"}>
                      {totals.failedRuns}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-600">Contacted candidates</dt>
                  <dd className="font-medium tabular-nums text-slate-900">{totals.contacted}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-600">Rejected candidates</dt>
                  <dd className="font-medium tabular-nums text-slate-900">{totals.rejected}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Users className="h-4 w-4 text-indigo-600" />
                Teams
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Each team&apos;s manager and combined output
              </CardDescription>
            </div>
            <CreateTeamForm />
          </CardHeader>
          <CardContent className="pt-4">
            <TeamsOverview teams={teams} managerOptions={managerOptions} />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Target className="h-4 w-4 text-indigo-600" />
              User Performance
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Jobs, sourcing runs (completed / total), and candidate outcomes per user
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <UserPerformanceTable users={users} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="col-span-1 border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                User Management
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Assign roles and teams, or deactivate access
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <UserManagement users={users} teamOptions={teamOptions} currentUserId={user.id} />
            </CardContent>
          </Card>

          <Card className="col-span-1 border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <History className="h-4 w-4 text-indigo-600" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Latest recorded actions across the organization
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <ActivityFeed activity={recentActivity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
