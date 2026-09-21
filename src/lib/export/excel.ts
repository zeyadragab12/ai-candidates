import * as XLSX from "xlsx";

export interface CandidateExportRow {
  name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  experience_years: number | null;
  skills: string[];
  match_score: number | null;
  skills_score: number | null;
  experience_score: number | null;
  location_score: number | null;
  education_score: number | null;
  seniority_score: number | null;
  matched_requirements: string[];
  missing_requirements: string[];
  ai_summary: string | null;
  source: string;
  profile_url: string | null;
  status: string;
  notes: string[];
  created_at: string;
}

const COLUMNS = [
  "Name",
  "Headline",
  "Company",
  "Location",
  "Experience",
  "Skills",
  "Match Score",
  "Skills Score",
  "Experience Score",
  "Location Score",
  "Education Score",
  "Seniority Score",
  "Matched Requirements",
  "Missing Requirements",
  "AI Summary",
  "Source",
  "Profile URL",
  "Status",
  "Recruiter Notes",
  "Date Added",
] as const;

// Column widths tuned for readability without manual resizing.
const COLUMN_WIDTHS = [
  20, 24, 20, 18, 12, 30, 12, 12, 16, 14, 14, 14, 30, 30, 40, 10, 30, 12, 30, 14,
];

function joinOrEmpty(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "";
}

function scoreOrEmpty(score: number | null): number | string {
  return score ?? "";
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString();
}

function rowToArray(row: CandidateExportRow): (string | number)[] {
  return [
    row.name ?? "",
    row.headline ?? "",
    row.company ?? "",
    row.location ?? "",
    row.experience_years ?? "",
    joinOrEmpty(row.skills),
    scoreOrEmpty(row.match_score),
    scoreOrEmpty(row.skills_score),
    scoreOrEmpty(row.experience_score),
    scoreOrEmpty(row.location_score),
    scoreOrEmpty(row.education_score),
    scoreOrEmpty(row.seniority_score),
    joinOrEmpty(row.matched_requirements),
    joinOrEmpty(row.missing_requirements),
    row.ai_summary ?? "",
    row.source,
    row.profile_url ?? "",
    row.status,
    joinOrEmpty(row.notes),
    formatDate(row.created_at),
  ];
}

export function buildCandidatesWorkbook(
  rows: CandidateExportRow[],
): XLSX.WorkBook {
  const sheetData: (string | number)[][] = [
    [...COLUMNS],
    ...rows.map(rowToArray),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet["!cols"] = COLUMN_WIDTHS.map((width) => ({ wch: width }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");

  return workbook;
}

export function workbookToBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
