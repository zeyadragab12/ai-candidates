import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

import { Badge, matchScoreTone } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/auth/roleDefinitions";
import { formatRelativeTime } from "@/lib/dates/formatRelativeTime";
import type { UserPerformanceRow } from "@/lib/performance/userStats";

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function TeamMemberCards({
  members,
  managerId,
}: {
  members: UserPerformanceRow[];
  managerId: string | null;
}) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Users className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-slate-900">No team members yet</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          An admin can add HR users to this team from the Admin dashboard.
        </p>
      </div>
    );
  }

  // Manager first, then everyone else alphabetically.
  const ordered = [...members].sort((a, b) =>
    a.id === managerId ? -1 : b.id === managerId ? 1 : 0,
  );

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="team-member-cards">
      {ordered.map((member) => (
        <li key={member.id}>
          <Link
            href={`/manager/team/${member.id}`}
            className="group flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700"
                  aria-hidden="true"
                >
                  {initialsOf(member.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-500">
                    {member.id === managerId ? "Team Manager" : ROLE_LABELS[member.role]}
                    {!member.isActive && " · Inactive"}
                  </p>
                </div>
              </div>
              <ChevronRight
                className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Active files</dt>
                <dd className="font-display text-lg font-semibold tabular-nums text-slate-900">
                  {member.activeRuns}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Candidates</dt>
                <dd className="font-display text-lg font-semibold tabular-nums text-slate-900">
                  {member.candidates}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Shortlisted</dt>
                <dd className="font-display text-lg font-semibold tabular-nums text-slate-900">
                  {member.shortlisted}
                </dd>
              </div>
            </dl>

            <div className="mt-auto flex items-center justify-between text-xs text-slate-500">
              <span>
                {member.runs} {member.runs === 1 ? "file" : "files"} · last active{" "}
                {formatRelativeTime(member.lastActivityAt)}
              </span>
              {member.averageMatchQuality !== null && (
                <Badge tone={matchScoreTone(member.averageMatchQuality)}>
                  {member.averageMatchQuality}% match
                </Badge>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
