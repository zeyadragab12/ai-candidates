import { Download } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_RANGE_LABELS, DATE_RANGES, type DateRangeSelection } from "@/lib/dates/dateRange";
import { cn } from "@/lib/utils";
import { REPORT_META, REPORT_TYPES, type ReportType } from "@/lib/reports/types";

// Radix Select can't use "" as an item value; the scope parser ignores it.
const WHOLE_ORG = "all";

function toQuery(values: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function ReportControls({
  type,
  selection,
  teamId,
  teamOptions,
}: {
  type: ReportType;
  selection: DateRangeSelection;
  teamId: string | null;
  /** Admins only; null hides the scope picker. */
  teamOptions: { id: string; name: string }[] | null;
}) {
  const shared = {
    range: selection.range,
    from: selection.range === "custom" ? selection.from : null,
    to: selection.range === "custom" ? selection.to : null,
    teamId,
  };
  const exportHref = (format: "csv" | "xlsx") =>
    `/api/reports?${toQuery({ ...shared, type, format })}`;

  return (
    <div className="flex flex-col gap-4">
      <nav
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
        aria-label="Report type"
      >
        {REPORT_TYPES.map((option) => (
          <Link
            key={option}
            href={`/reports?${toQuery({ ...shared, type: option })}`}
            aria-current={option === type ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              option === type
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {REPORT_META[option].title}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <form
          method="get"
          action="/reports"
          className="flex flex-wrap items-end gap-3"
          aria-label="Report filters"
        >
          <input type="hidden" name="type" value={type} />

          {teamOptions && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Scope</span>
              <Select name="teamId" defaultValue={teamId ?? WHOLE_ORG}>
                <SelectTrigger className="h-9 w-48 bg-white" aria-label="Report scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WHOLE_ORG}>Whole organization</SelectItem>
                  {teamOptions.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Period</span>
            <Select name="range" defaultValue={selection.range}>
              <SelectTrigger className="h-9 w-40 bg-white" aria-label="Report period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range} value={range}>
                    {DATE_RANGE_LABELS[range]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="report-from" className="text-xs font-medium text-slate-500">
              From
            </label>
            <Input
              id="report-from"
              type="date"
              name="from"
              defaultValue={selection.from ?? ""}
              className="h-9 w-40 bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="report-to" className="text-xs font-medium text-slate-500">
              To
            </label>
            <Input
              id="report-to"
              type="date"
              name="to"
              defaultValue={selection.to ?? ""}
              className="h-9 w-40 bg-white"
            />
          </div>

          <Button type="submit">Update report</Button>
        </form>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={exportHref("csv")} download>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={exportHref("xlsx")} download>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Excel
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
