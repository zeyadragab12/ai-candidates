import { describe, expect, it } from "vitest";

import { resolveDateWindow } from "@/lib/dates/dateRange";
import { hasActiveFilters, parseSourcingFileFilters, parseUuid } from "@/lib/manager/filters";

const MEMBER_ID = "0669eb0c-7dd5-4584-92a7-63dfeb400148";

describe("parseSourcingFileFilters", () => {
  it("returns no filters for empty params", () => {
    const filters = parseSourcingFileFilters({});
    expect(filters).toEqual({
      memberId: null,
      status: null,
      jobTitle: null,
      range: "all",
      from: null,
      to: null,
      minMatch: null,
      minCandidates: null,
    });
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it("parses every valid filter", () => {
    const filters = parseSourcingFileFilters({
      member: MEMBER_ID,
      status: "complete",
      title: "  React  ",
      range: "30d",
      minMatch: "70",
      minCandidates: "5",
    });
    expect(filters).toMatchObject({
      memberId: MEMBER_ID,
      status: "complete",
      jobTitle: "React",
      range: "30d",
      minMatch: 70,
      minCandidates: 5,
    });
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("treats the 'all' sentinel and garbage values as no filter", () => {
    const filters = parseSourcingFileFilters({
      member: "all",
      status: "all",
      range: "forever",
      minMatch: "150",
      minCandidates: "-3",
    });
    expect(filters.memberId).toBeNull();
    expect(filters.status).toBeNull();
    expect(filters.range).toBe("all");
    expect(filters.minMatch).toBeNull();
    expect(filters.minCandidates).toBeNull();
  });

  it("rejects a member id that isn't a uuid (e.g. an injection attempt)", () => {
    expect(parseSourcingFileFilters({ member: "1' or '1'='1" }).memberId).toBeNull();
    expect(parseUuid("not-a-uuid")).toBeNull();
    expect(parseUuid(MEMBER_ID)).toBe(MEMBER_ID);
  });

  it("uses the first value when a param is repeated", () => {
    expect(parseSourcingFileFilters({ status: ["error", "complete"] }).status).toBe("error");
  });

  it("switches to a custom range when dates are given without one", () => {
    const filters = parseSourcingFileFilters({ from: "2026-09-01", to: "2026-09-10" });
    expect(filters.range).toBe("custom");
    expect(filters.from).toBe("2026-09-01");
    expect(filters.to).toBe("2026-09-10");
  });

  it("drops malformed dates", () => {
    const filters = parseSourcingFileFilters({ range: "custom", from: "09/01/2026" });
    expect(filters.from).toBeNull();
  });

  it("caps an overly long title", () => {
    expect(parseSourcingFileFilters({ title: "x".repeat(500) }).jobTitle).toHaveLength(120);
  });
});

describe("resolveDateWindow", () => {
  const now = new Date(2026, 8, 25, 15, 30); // 25 Sep 2026, local time

  it("has no bounds for all time", () => {
    expect(resolveDateWindow(parseSourcingFileFilters({}), now)).toEqual({ from: null, to: null });
  });

  it("starts today at local midnight", () => {
    const { from, to } = resolveDateWindow(parseSourcingFileFilters({ range: "today" }), now);
    expect(from).toBe(new Date(2026, 8, 25).toISOString());
    expect(to).toBeNull();
  });

  it("counts today as the first of the last 7 days", () => {
    const { from } = resolveDateWindow(parseSourcingFileFilters({ range: "7d" }), now);
    expect(from).toBe(new Date(2026, 8, 19).toISOString());
  });

  it("makes a custom range's end date inclusive", () => {
    const { from, to } = resolveDateWindow(
      parseSourcingFileFilters({ range: "custom", from: "2026-09-01", to: "2026-09-10" }),
      now,
    );
    expect(from).toBe(new Date(2026, 8, 1).toISOString());
    expect(to).toBe(new Date(2026, 8, 11).toISOString());
  });
});
