import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";

import { buildCandidatesWorkbook, workbookToBuffer, type CandidateExportRow } from "./excel";

function getCandidatesSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const sheet = workbook.Sheets["Candidates"];
  if (!sheet) throw new Error("Candidates sheet not found");
  return sheet;
}

function makeRow(overrides: Partial<CandidateExportRow> = {}): CandidateExportRow {
  return {
    name: "Amina Hassan",
    headline: "Senior React Developer",
    company: "Nile Software",
    location: "Cairo, Egypt",
    experience_years: 5,
    skills: ["React", "TypeScript"],
    match_score: 88,
    skills_score: 92,
    experience_score: 85,
    location_score: 100,
    education_score: 60,
    seniority_score: 90,
    matched_requirements: ["React", "TypeScript"],
    missing_requirements: ["AWS"],
    ai_summary: "Strong match overall.",
    source: "mock",
    profile_url: "https://example.com/in/amina",
    status: "New",
    notes: ["Great communicator"],
    created_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

const EXPECTED_HEADERS = [
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
];

describe("buildCandidatesWorkbook", () => {
  it("builds a workbook from 3 fixture candidates that parses back cleanly with SheetJS", () => {
    const rows = [
      makeRow({ name: "Amina Hassan" }),
      makeRow({ name: "Omar El-Sayed", company: null, location: null }),
      makeRow({ name: "Sara Youssef", skills: [], matched_requirements: [] }),
    ];

    const workbook = buildCandidatesWorkbook(rows);
    const sheet = getCandidatesSheet(workbook);
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.["Name"]).toBe("Amina Hassan");
    expect(parsed[1]?.["Name"]).toBe("Omar El-Sayed");
    expect(parsed[2]?.["Name"]).toBe("Sara Youssef");
  });

  it("has exactly the columns the spec requires, in order", () => {
    const workbook = buildCandidatesWorkbook([makeRow()]);
    const sheet = getCandidatesSheet(workbook);
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    expect(rows[0]).toEqual(EXPECTED_HEADERS);
  });

  it("joins array fields into readable text, not raw JSON", () => {
    const workbook = buildCandidatesWorkbook([
      makeRow({ skills: ["React", "TypeScript", "Next.js"] }),
    ]);
    const sheet = getCandidatesSheet(workbook);
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    expect(parsed[0]?.["Skills"]).toBe("React, TypeScript, Next.js");
    expect(parsed[0]?.["Skills"]).not.toContain("[");
    expect(parsed[0]?.["Skills"]).not.toContain("{");
  });

  it("renders null/missing fields as empty cells, not the literal string 'null'", () => {
    const workbook = buildCandidatesWorkbook([
      makeRow({
        company: null,
        location: null,
        experience_years: null,
        match_score: null,
        profile_url: null,
        skills: [],
        notes: [],
      }),
    ]);
    const sheet = getCandidatesSheet(workbook);
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    expect(parsed[0]?.["Company"]).toBe("");
    expect(parsed[0]?.["Location"]).toBe("");
    expect(parsed[0]?.["Match Score"]).toBe("");
    expect(JSON.stringify(parsed[0])).not.toContain("null");
  });

  it("formats the date as a readable date, not a raw ISO timestamp", () => {
    const workbook = buildCandidatesWorkbook([
      makeRow({ created_at: "2026-03-15T10:30:00Z" }),
    ]);
    const sheet = getCandidatesSheet(workbook);
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    expect(parsed[0]?.["Date Added"]).not.toContain("T10:30:00");
  });

  it("sets column widths so cells don't need manual resizing", () => {
    const workbook = buildCandidatesWorkbook([makeRow()]);
    const sheet = getCandidatesSheet(workbook);

    expect(sheet["!cols"]).toBeDefined();
    expect(sheet["!cols"]?.length).toBe(EXPECTED_HEADERS.length);
  });

  it("handles an empty candidate list without crashing", () => {
    const workbook = buildCandidatesWorkbook([]);
    const sheet = getCandidatesSheet(workbook);
    const parsed = XLSX.utils.sheet_to_json(sheet);
    expect(parsed).toEqual([]);
  });

  it("stores score and experience columns as real numbers, not text, so Excel can sort/filter them without conversion", () => {
    const workbook = buildCandidatesWorkbook([
      makeRow({ match_score: 88, skills_score: 92, experience_years: 5 }),
    ]);
    const sheet = getCandidatesSheet(workbook);

    // "Match Score" is column G, "Experience" is column E, in row 2 (1-indexed after header).
    expect(sheet["G2"]?.t).toBe("n");
    expect(sheet["E2"]?.t).toBe("n");
  });

  it("produces a structurally valid .xlsx archive, verified independently with a different library (jszip) than the one that wrote it", async () => {
    const workbook = buildCandidatesWorkbook([makeRow()]);
    const buffer = workbookToBuffer(workbook);

    const zip = await JSZip.loadAsync(buffer);
    const entryNames = Object.keys(zip.files);

    expect(entryNames).toContain("[Content_Types].xml");
    expect(entryNames).toContain("xl/workbook.xml");
    expect(entryNames.some((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))).toBe(
      true,
    );

    const contentTypes = await zip.files["[Content_Types].xml"]?.async("string");
    expect(contentTypes).toContain("spreadsheetml");
  });
});
