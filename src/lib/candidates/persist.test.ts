import { describe, expect, it } from "vitest";

import { persistCandidates } from "./persist";
import type { NormalizedCandidate } from "@/types/candidate";

interface FakeRowInsert {
  user_id: string;
  profile_url: string | null;
  name: string | null;
  company: string | null;
  [key: string]: unknown;
}

interface FakeRow extends FakeRowInsert {
  id: string;
}

type Filter =
  | { op: "eq"; col: string; val: unknown }
  | { op: "is"; col: string; val: unknown }
  | { op: "ilike"; col: string; val: string };

/** Mirrors real Postgres ILIKE closely enough for these tests: a pattern
 * wrapped in `%...%` is a case-insensitive substring match, otherwise it's
 * a case-insensitive exact match. */
function matchesIlike(value: unknown, pattern: string): boolean {
  const haystack = String(value ?? "").toLowerCase();
  const needle = pattern.toLowerCase();
  if (needle.startsWith("%") && needle.endsWith("%")) {
    return haystack.includes(needle.slice(1, -1));
  }
  return haystack === needle;
}

function matchesFilters(row: FakeRow, filters: Filter[]): boolean {
  return filters.every((f) => {
    if (f.op === "eq") return row[f.col] === f.val;
    if (f.op === "is") return (row[f.col] ?? null) === f.val;
    return matchesIlike(row[f.col], f.val);
  });
}

function createFakeSupabase() {
  const rows: FakeRow[] = [];
  let idCounter = 1;

  return {
    from() {
      return {
        select() {
          const filters: Filter[] = [];
          const builder = {
            eq(col: string, val: unknown) {
              filters.push({ op: "eq", col, val });
              return builder;
            },
            is(col: string, val: unknown) {
              filters.push({ op: "is", col, val });
              return builder;
            },
            ilike(col: string, val: string) {
              filters.push({ op: "ilike", col, val });
              return builder;
            },
            async maybeSingle() {
              const match = rows.find((r) => matchesFilters(r, filters));
              return { data: match ?? null, error: null };
            },
            // Real supabase-js query builders are themselves awaitable
            // (thenable), returning every matching row as an array when
            // neither .single() nor .maybeSingle() is chained — used by
            // findExisting's name+company lookup, which filters
            // company-suffix variants in JS after fetching by name alone.
            then(resolve: (result: { data: FakeRow[]; error: null }) => void) {
              resolve({ data: rows.filter((r) => matchesFilters(r, filters)), error: null });
            },
          };
          return builder;
        },
        update(patch: Record<string, unknown>) {
          const filters: Filter[] = [];
          const builder = {
            eq(col: string, val: unknown) {
              filters.push({ op: "eq", col, val });
              return builder;
            },
            then(resolve: (result: { error: null }) => void) {
              const match = rows.find((r) => matchesFilters(r, filters));
              if (match) Object.assign(match, patch);
              resolve({ error: null });
            },
          };
          return builder;
        },
        insert(row: FakeRowInsert) {
          return {
            select() {
              return {
                async single() {
                  const conflict = rows.some((r) => {
                    if (r.user_id !== row.user_id) return false;
                    if (row.profile_url) return r.profile_url === row.profile_url;
                    if (row.name && row.company) {
                      return (
                        !r.profile_url &&
                        (r.name ?? "").toLowerCase() === row.name.toLowerCase() &&
                        (r.company ?? "").toLowerCase() === row.company.toLowerCase()
                      );
                    }
                    return false;
                  });

                  if (conflict) {
                    return {
                      data: null,
                      error: { code: "23505", message: "unique violation" },
                    };
                  }

                  const newRow: FakeRow = { ...row, id: `id-${idCounter++}` };
                  rows.push(newRow);
                  return { data: { id: newRow.id }, error: null };
                },
              };
            },
          };
        },
      };
    },
    rows,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeCandidate(
  overrides: Partial<NormalizedCandidate> = {},
): NormalizedCandidate {
  return {
    name: null,
    headline: null,
    current_company: null,
    location: null,
    profile_url: null,
    profile_image_url: null,
    source: "mock",
    source_url: "https://example.com/search",
    summary: null,
    skills: [],
    experience_years: null,
    ...overrides,
  };
}

const USER_ID = "user-1";

describe("persistCandidates", () => {
  it("inserts a new candidate identified by profile_url", async () => {
    const supabase = createFakeSupabase();
    const results = await persistCandidates(supabase, USER_ID, [
      makeCandidate({ name: "Amina", profile_url: "https://example.com/in/amina" }),
    ]);
    expect(results).toEqual([{ id: "id-1", isNew: true }]);
    expect(supabase.rows).toHaveLength(1);
  });

  it("re-running with the same profile_url does not create a duplicate row", async () => {
    const supabase = createFakeSupabase();
    const candidate = makeCandidate({
      name: "Amina",
      profile_url: "https://example.com/in/amina",
    });

    await persistCandidates(supabase, USER_ID, [candidate]);
    const secondRun = await persistCandidates(supabase, USER_ID, [candidate]);

    expect(secondRun).toEqual([{ id: "id-1", isNew: false }]);
    expect(supabase.rows).toHaveLength(1);
  });

  it("inserts a new candidate identified by name+company when no profile_url exists", async () => {
    const supabase = createFakeSupabase();
    const results = await persistCandidates(supabase, USER_ID, [
      makeCandidate({ name: "Sara Youssef", current_company: "Delta Digital" }),
    ]);
    expect(results[0]?.isNew).toBe(true);
    expect(supabase.rows).toHaveLength(1);
  });

  it("re-running with the same name+company does not create a duplicate row", async () => {
    const supabase = createFakeSupabase();
    const candidate = makeCandidate({
      name: "Sara Youssef",
      current_company: "Delta Digital",
    });

    await persistCandidates(supabase, USER_ID, [candidate]);
    const secondRun = await persistCandidates(supabase, USER_ID, [candidate]);

    expect(secondRun[0]?.isNew).toBe(false);
    expect(supabase.rows).toHaveLength(1);
  });

  it("always inserts candidates with no reliable identity, even across repeated calls", async () => {
    const supabase = createFakeSupabase();
    const candidate = makeCandidate({ summary: "No name or company available." });

    await persistCandidates(supabase, USER_ID, [candidate]);
    await persistCandidates(supabase, USER_ID, [candidate]);

    expect(supabase.rows).toHaveLength(2);
  });

  it("stores raw_data when provided via the raw-data map", async () => {
    const supabase = createFakeSupabase();
    const candidate = makeCandidate({
      name: "Amina",
      profile_url: "https://example.com/in/amina",
    });
    const rawMap = new Map([[candidate, { source: "mock", title: "raw title" }]]);

    await persistCandidates(supabase, USER_ID, [candidate], rawMap);

    expect(supabase.rows[0].raw_data).toEqual({ source: "mock", title: "raw title" });
  });

  it("backfills skills onto an already-persisted candidate re-found by a later search", async () => {
    const supabase = createFakeSupabase();
    const firstPass = makeCandidate({
      name: "Amina",
      profile_url: "https://example.com/in/amina",
      skills: [],
    });
    await persistCandidates(supabase, USER_ID, [firstPass]);
    expect(supabase.rows[0].skills).toEqual([]);

    const secondPass = makeCandidate({
      name: "Amina",
      profile_url: "https://example.com/in/amina",
      skills: ["React", "TypeScript"],
    });
    const results = await persistCandidates(supabase, USER_ID, [secondPass]);

    expect(results).toEqual([{ id: "id-1", isNew: false }]);
    expect(supabase.rows[0].skills).toEqual(["React", "TypeScript"]);
  });

  it("unions skills instead of replacing them when re-found with a different set", async () => {
    const supabase = createFakeSupabase();
    await persistCandidates(supabase, USER_ID, [
      makeCandidate({
        name: "Amina",
        profile_url: "https://example.com/in/amina",
        skills: ["React"],
      }),
    ]);

    await persistCandidates(supabase, USER_ID, [
      makeCandidate({
        name: "Amina",
        profile_url: "https://example.com/in/amina",
        skills: ["TypeScript"],
      }),
    ]);

    expect(supabase.rows[0].skills.sort()).toEqual(["React", "TypeScript"]);
  });

  it("does not overwrite an existing non-null field with new data", async () => {
    const supabase = createFakeSupabase();
    await persistCandidates(supabase, USER_ID, [
      makeCandidate({
        name: "Amina",
        profile_url: "https://example.com/in/amina",
        headline: "Original Headline",
      }),
    ]);

    await persistCandidates(supabase, USER_ID, [
      makeCandidate({
        name: "Amina",
        profile_url: "https://example.com/in/amina",
        headline: "Different Headline",
      }),
    ]);

    expect(supabase.rows[0].headline).toBe("Original Headline");
  });

  it("cross-run/cross-job: re-finds an already-persisted LinkedIn candidate discovered via a different country subdomain (BEFORE this change: created a duplicate row)", async () => {
    const supabase = createFakeSupabase();
    await persistCandidates(supabase, USER_ID, [
      makeCandidate({
        name: "Amina Hassan",
        profile_url: "https://www.linkedin.com/in/amina-hassan",
      }),
    ]);

    // A later search run — for the same or a different job, findExisting is
    // scoped only to the user, not a job — surfaces the same person via a
    // country-subdomain variant of the same profile URL.
    const secondRun = await persistCandidates(supabase, USER_ID, [
      makeCandidate({
        name: "Amina Hassan",
        profile_url: "https://eg.linkedin.com/in/amina-hassan/?trk=public_profile",
      }),
    ]);

    expect(secondRun).toEqual([{ id: "id-1", isNew: false }]);
    expect(supabase.rows).toHaveLength(1);
  });

  it("cross-run: re-finds an already-persisted candidate whose company name now has a legal-entity suffix (BEFORE this change: created a duplicate row)", async () => {
    const supabase = createFakeSupabase();
    await persistCandidates(supabase, USER_ID, [
      makeCandidate({ name: "Sara Youssef", current_company: "Delta Digital" }),
    ]);

    const secondRun = await persistCandidates(supabase, USER_ID, [
      makeCandidate({ name: "Sara Youssef", current_company: "Delta Digital Inc." }),
    ]);

    expect(secondRun).toEqual([{ id: "id-1", isNew: false }]);
    expect(supabase.rows).toHaveLength(1);
  });

  it("still keeps two different candidates who share a name but work at genuinely different companies as 2 rows (avoids false-positive merges)", async () => {
    const supabase = createFakeSupabase();
    await persistCandidates(supabase, USER_ID, [
      makeCandidate({ name: "Mohamed Ahmed", current_company: "Acme Inc." }),
    ]);

    const secondRun = await persistCandidates(supabase, USER_ID, [
      makeCandidate({ name: "Mohamed Ahmed", current_company: "Globex Inc." }),
    ]);

    expect(secondRun[0]?.isNew).toBe(true);
    expect(supabase.rows).toHaveLength(2);
  });

  it("falls back to the existing row when a race causes a unique-violation on insert", async () => {
    // Simulates: our pre-insert check sees nothing (call #1), a concurrent
    // request inserts the same candidate, our insert then fails with a
    // unique violation, and our fallback re-check (call #2) finds it.
    let maybeSingleCallCount = 0;
    const supabase = {
      from() {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              async maybeSingle() {
                maybeSingleCallCount += 1;
                if (maybeSingleCallCount === 1) {
                  return { data: null, error: null };
                }
                return { data: { id: "existing-id" }, error: null };
              },
            };
          },
          insert() {
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: null,
                      error: { code: "23505", message: "unique violation" },
                    };
                  },
                };
              },
            };
          },
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const candidate = makeCandidate({
      name: "Amina",
      profile_url: "https://example.com/in/amina",
    });

    const results = await persistCandidates(supabase, USER_ID, [candidate]);
    expect(results).toEqual([{ id: "existing-id", isNew: false }]);
  });
});
