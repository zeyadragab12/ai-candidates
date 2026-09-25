import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import type { TeamSourcingFileRow } from "@/lib/manager/getTeamDashboardData";
import type { ProfileRow, UserStatsRow } from "@/lib/performance/userStats";
import {
  buildActivityReport,
  buildPerformanceReport,
  buildPipelineReport,
  buildQualityReport,
} from "@/lib/reports/builders";
import { reportFileName, reportToCsv, reportToXlsx } from "@/lib/reports/serialize";

const meta = { scopeLabel: "Default Team", rangeLabel: "Last 30 days", generatedAt: "2026-09-25T12:00:00.000Z" };

function profile(id: string, email: string, overrides: Partial<ProfileRow> = {}): ProfileRow {
  return { id, email, role: "hr_user", team_id: "t1", is_active: true, created_at: "2026-09-01", ...overrides };
}

function stats(userId: string, overrides: Partial<UserStatsRow> = {}): UserStatsRow {
  return {
    user_id: userId,
    jobs_count: 0,
    runs_count: 0,
    completed_runs: 0,
    active_runs: 0,
    failed_runs: 0,
    candidates_count: 0,
    new_count: 0,
    reviewed_count: 0,
    shortlisted_count: 0,
    contacted_count: 0,
    rejected_count: 0,
    run_avg_sum: 0,
    run_avg_count: 0,
    last_activity_at: null,
    ...overrides,
  };
}

const sara = profile("u1", "sara.ali@example.com");
const omar = profile("u2", "omar.hassan@example.com", { is_active: false });

const statsMap = new Map([
  ["u1", stats("u1", { jobs_count: 3, runs_count: 4, completed_runs: 3, candidates_count: 20, new_count: 10, shortlisted_count: 6, contacted_count: 2, rejected_count: 2, run_avg_sum: 150, run_avg_count: 2 })],
  ["u2", stats("u2", { jobs_count: 1, runs_count: 1, completed_runs: 1, candidates_count: 10, new_count: 10, run_avg_sum: "60", run_avg_count: 1 })],
  // Present in the stats map (e.g. an admin caller) but not in scope — must never be counted.
  ["u3", stats("u3", { jobs_count: 99, candidates_count: 999, run_avg_sum: 1, run_avg_count: 1 })],
]);

describe("buildPerformanceReport", () => {
  const report = buildPerformanceReport([sara, omar], statsMap, meta);
  const section = report.sections[0]!;

  it("has one row per in-scope member, sorted by name, flagging inactive members", () => {
    expect(section.rows.map((row) => row.member)).toEqual(["Omar Hassan (inactive)", "Sara Ali"]);
  });

  it("totals only in-scope members, never someone outside the scope", () => {
    expect(section.totals).toMatchObject({ jobs: 4, runs: 5, candidates: 30, shortlisted: 6 });
  });

  it("combines match quality as an average of per-file averages", () => {
    // (150 + 60) / (2 + 1) files = 70
    expect(section.totals?.averageMatch).toBe(70);
    expect(section.rows.find((row) => row.member === "Sara Ali")?.averageMatch).toBe(75);
  });

  it("shows a member with no stats as zeros, not missing", () => {
    const empty = buildPerformanceReport([profile("u9", "new.person@example.com")], statsMap, meta);
    expect(empty.sections[0]!.rows[0]).toMatchObject({ jobs: 0, candidates: 0, averageMatch: null });
  });
});

describe("buildPipelineReport", () => {
  it("counts each status and the share that progressed", () => {
    const report = buildPipelineReport([sara, omar], statsMap, meta);
    const section = report.sections[0]!;
    expect(section.totals).toMatchObject({ total: 30, new: 20, shortlisted: 6, contacted: 2, rejected: 2 });
    // (6 shortlisted + 2 contacted) / 30
    expect(section.totals?.progressed).toBe(27);
    expect(section.rows.find((row) => row.member === "Sara Ali")?.progressed).toBe(40);
  });
});

describe("buildActivityReport", () => {
  const report = buildActivityReport(
    [sara, omar],
    statsMap,
    [
      { user_id: "u1", action: "auth.login", event_count: 5, last_at: "2026-09-20T10:00:00Z" },
      { user_id: "u1", action: "auth.login_failed", event_count: 1, last_at: "2026-09-19T10:00:00Z" },
      { user_id: "u1", action: "candidate.status_changed", event_count: 8, last_at: "2026-09-22T10:00:00Z" },
      { user_id: "u2", action: "job.created", event_count: 2, last_at: "2026-09-18T10:00:00Z" },
      { user_id: "u3", action: "auth.login", event_count: 50, last_at: "2026-09-23T10:00:00Z" },
    ],
    meta,
  );
  const members = report.sections[0]!;

  it("buckets actions per member and ignores out-of-scope users", () => {
    const saraRow = members.rows.find((row) => row.member === "Sara Ali");
    expect(saraRow).toMatchObject({ logins: 5, failedLogins: 1, candidateActions: 8, total: 14, runs: 4 });
    expect(saraRow?.lastActivity).toBe("2026-09-22T10:00:00Z");
    expect(members.totals).toMatchObject({ logins: 5, total: 16 });
  });

  it("lists actions by type with friendly labels", () => {
    const actions = report.sections[1]!.rows;
    expect(actions[0]).toEqual({ action: "Candidate status changed", events: 8, members: 1 });
    expect(actions.some((row) => row.action === "Signed in")).toBe(true);
  });
});

describe("buildQualityReport", () => {
  const file = (overrides: Partial<TeamSourcingFileRow>): TeamSourcingFileRow => ({
    runId: "r",
    jobId: "j1",
    jobTitle: "React Developer",
    sourcingStatus: "complete",
    ownerId: "u1",
    ownerName: "Sara Ali",
    startedBy: null,
    createdAt: "2026-09-20T10:00:00Z",
    totalCandidates: 10,
    shortlistedCandidates: 2,
    unseenCandidates: 0,
    averageMatch: null,
    lastAccessedBy: null,
    lastAccessedByOther: false,
    lastActivityAt: null,
    ...overrides,
  });

  it("groups files by job and counts strong / weak files", () => {
    const report = buildQualityReport(
      [sara, omar],
      statsMap,
      [
        file({ runId: "a", averageMatch: 80 }),
        file({ runId: "b", averageMatch: 60 }),
        file({ runId: "c", jobId: "j2", jobTitle: "Data Analyst", averageMatch: 30 }),
        file({ runId: "d", jobId: "j2", jobTitle: "Data Analyst" }),
      ],
      meta,
    );
    const byJob = report.sections.find((section) => section.id === "jobs")!.rows;
    expect(byJob[0]).toMatchObject({ job: "React Developer", files: 2, averageMatch: 70, bestMatch: 80 });
    expect(byJob[1]).toMatchObject({ job: "Data Analyst", files: 2, evaluatedFiles: 1, averageMatch: 30 });
    expect(report.summary).toEqual(
      expect.arrayContaining([
        { label: "Files evaluated", value: "3 / 4" },
        { label: "Strong files (≥ 70%)", value: "1" },
        { label: "Weak files (< 40%)", value: "1" },
      ]),
    );
  });
});

describe("report export", () => {
  const report = buildQualityReport(
    [profile("u1", "sara.ali@example.com")],
    statsMap,
    [
      {
        runId: "x",
        jobId: "j",
        jobTitle: '=HYPERLINK("http://evil.example","click")',
        sourcingStatus: "complete",
        ownerId: "u1",
        ownerName: "Sara Ali",
        startedBy: null,
        createdAt: "2026-09-20T10:00:00Z",
        totalCandidates: 3,
        shortlistedCandidates: 1,
        unseenCandidates: 0,
        averageMatch: 72,
        lastAccessedBy: null,
        lastAccessedByOther: false,
        lastActivityAt: null,
      },
    ],
    meta,
  );

  it("neutralizes spreadsheet formulas in CSV cells", () => {
    const csv = reportToCsv(report);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
  });

  it("writes a UTF-8 BOM, the report header, and every section", () => {
    const csv = reportToCsv(report);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Sourcing Quality report");
    expect(csv).toContain("Scope,Default Team");
    expect(csv).toContain("Match quality by member");
    expect(csv).toContain("Avg match (%)");
  });

  it("builds an Excel workbook with an overview sheet plus one sheet per section", () => {
    const workbook = XLSX.read(reportToXlsx(report), { type: "buffer" });
    expect(workbook.SheetNames).toEqual([
      "Overview",
      "Match quality by member",
      "Match quality by job",
      "Match quality by sourcing file",
    ]);
  });

  it("names the file after the report, scope and date", () => {
    expect(reportFileName(report, "csv")).toBe("sourcing-quality-report-default-team-2026-09-25.csv");
  });
});
