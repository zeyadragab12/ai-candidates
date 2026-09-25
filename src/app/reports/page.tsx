import { FileBarChart } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/dashboard/nav";
import { ReportControls } from "@/components/reports/report-controls";
import { ReportView } from "@/components/reports/report-view";
import { logActivityOnce } from "@/lib/activity/log";
import { getProfile } from "@/lib/auth/access";
import { parseDateRange, singleParam, type SearchParams } from "@/lib/dates/dateRange";
import { parseUuid } from "@/lib/manager/filters";
import { generateReport, ReportLoadError } from "@/lib/reports/generateReport";
import { resolveReportScope } from "@/lib/reports/scope";
import { parseReportType, type Report } from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";

const VIEW_LOG_WINDOW_MS = 10 * 60 * 1000;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile || !profile.is_active) redirect("/login");

  const type = parseReportType(singleParam(params, "type")) ?? "performance";
  const selection = parseDateRange(params, "30d");
  const { scope, teamOptions } = await resolveReportScope(
    supabase,
    profile,
    parseUuid(singleParam(params, "teamId")),
  );

  let report: Report | null = null;
  let loadError: string | null = null;
  try {
    report = await generateReport(supabase, type, scope, selection);
  } catch (error) {
    if (!(error instanceof ReportLoadError)) throw error;
    loadError = "This report couldn't be generated. Try again in a moment.";
  }

  if (report) {
    await logActivityOnce(
      supabase,
      {
        userId: user.id,
        action: "report.viewed",
        entityType: "report",
        description: `Viewed the ${report.title} report (${report.scopeLabel}, ${report.rangeLabel})`,
        metadata: { type, scope: scope.kind, teamId: scope.teamId, range: selection },
      },
      VIEW_LOG_WINDOW_MS,
    );
  }

  const scopeHint =
    scope.kind === "org"
      ? "Admin view: every user in the organization."
      : scope.kind === "team"
        ? `Everyone in ${scope.label}.`
        : "Your own work only.";

  return (
    <main className="min-h-screen bg-slate-50/70 pb-16">
      <DashboardNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
              <FileBarChart className="h-3.5 w-3.5" aria-hidden="true" />
              {scope.label} · {report?.rangeLabel ?? ""}
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {report ? `${report.title} Report` : "Reports"}
            </h1>
            <p className="mt-2 text-base leading-relaxed text-slate-300">
              {report?.description} {scopeHint}
            </p>
          </div>
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <ReportControls
          type={type}
          selection={selection}
          teamId={scope.kind === "team" && teamOptions ? scope.teamId : null}
          teamOptions={teamOptions}
        />

        {loadError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <p role="alert" className="text-sm font-medium text-red-800">
              {loadError}
            </p>
          </div>
        )}

        {report && <ReportView report={report} />}
      </div>
    </main>
  );
}
