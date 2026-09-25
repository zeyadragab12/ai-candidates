import { Badge, matchScoreTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyCell } from "@/components/ui/empty-cell";
import type { Report, ReportCell, ReportColumn, ReportSection } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

function CellValue({ column, value }: { column: ReportColumn; value: ReportCell }) {
  if (value === null || value === "") return <EmptyCell />;
  if (column.kind === "match" && typeof value === "number") {
    return <Badge tone={matchScoreTone(value)}>{value}%</Badge>;
  }
  if (column.kind === "percent" && typeof value === "number") {
    return <>{value}%</>;
  }
  if (column.kind === "date" && typeof value === "string") {
    return (
      <>
        {new Date(value).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </>
    );
  }
  return <>{value}</>;
}

function isNumeric(column: ReportColumn): boolean {
  return column.kind === "number" || column.kind === "percent" || column.kind === "match";
}

function SectionTable({ section }: { section: ReportSection }) {
  if (section.rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{section.emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table
        className="w-full text-sm"
        style={{ minWidth: `${Math.max(560, section.columns.length * 110)}px` }}
        data-testid={`report-section-${section.id}`}
      >
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
            {section.columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn("p-3 font-medium", isNumeric(column) && "text-right")}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
              {section.columns.map((column, columnIndex) => (
                <td
                  key={column.key}
                  className={cn(
                    "p-3 text-slate-700",
                    isNumeric(column) && "text-right tabular-nums",
                    columnIndex === 0 && "font-medium text-slate-900",
                  )}
                >
                  <CellValue column={column} value={row[column.key] ?? null} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {section.totals && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold text-slate-900">
              {section.columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("p-3", isNumeric(column) && "text-right tabular-nums")}
                >
                  <CellValue column={column} value={section.totals?.[column.key] ?? null} />
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function ReportView({ report }: { report: Report }) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {report.summary.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {item.label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-slate-900">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {report.sections.map((section) => (
        <Card key={section.id} className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">{section.title}</CardTitle>
            {section.description && (
              <CardDescription className="text-xs text-slate-500">
                {section.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            <SectionTable section={section} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
