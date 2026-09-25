import * as XLSX from "xlsx";

import type { Report, ReportCell, ReportSection } from "@/lib/reports/types";

export const EXPORT_FORMATS = ["csv", "xlsx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * Spreadsheet apps execute cells that start with these characters as
 * formulas, so a job title like `=HYPERLINK(...)` in a CSV could run when a
 * manager opens the export. Prefixing a quote makes it inert text.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function neutralize(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function exportValue(cell: ReportCell): string | number {
  if (cell === null) return "";
  if (typeof cell === "number") return cell;
  return neutralize(cell);
}

function csvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sectionMatrix(section: ReportSection): (string | number)[][] {
  const header = section.columns.map((column) =>
    column.kind === "percent" || column.kind === "match" ? `${column.label} (%)` : column.label,
  );
  const body = section.rows.map((row) => section.columns.map((column) => exportValue(row[column.key] ?? null)));
  const totals = section.totals
    ? [section.columns.map((column) => exportValue(section.totals?.[column.key] ?? null))]
    : [];
  return [header, ...body, ...totals];
}

function headerLines(report: Report): (string | number)[][] {
  return [
    [`${report.title} report`],
    ["Scope", report.scopeLabel],
    ["Period", report.rangeLabel],
    ["Generated", report.generatedAt],
  ];
}

export function reportToCsv(report: Report): string {
  const lines: (string | number)[][] = [...headerLines(report), []];
  for (const section of report.sections) {
    lines.push([section.title], ...sectionMatrix(section), []);
  }
  // BOM so Excel opens UTF-8 (names, en-dashes) correctly.
  return "﻿" + lines.map((line) => line.map(csvField).join(",")).join("\r\n");
}

export function reportToXlsx(report: Report): Buffer {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ...headerLines(report),
      [],
      ["Summary"],
      ...report.summary.map((item) => [item.label, item.value]),
    ]),
    "Overview",
  );

  const usedNames = new Set(["Overview"]);
  for (const section of report.sections) {
    // Sheet names are capped at 31 chars and must be unique.
    let name = section.title.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
    for (let suffix = 2; usedNames.has(name); suffix += 1) {
      name = `${section.title.slice(0, 28)} ${suffix}`;
    }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sectionMatrix(section)), name);
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function reportFileName(report: Report, format: ExportFormat): string {
  const slug = `${report.title} report ${report.scopeLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}-${report.generatedAt.slice(0, 10)}.${format}`;
}
