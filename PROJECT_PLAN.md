# PROJECT_PLAN — AI Candidate Sourcing & Recruitment Research Platform

Each step is meant to be built, verified, and confirmed before the next one starts.
No step depends on code from a *later* step. If a step's Verify column fails, stop
and fix before moving on — don't carry a red build into the next step.

Legend: **Verify** = the exact check that proves the step works. **Done when** =
the acceptance bar, not just "code compiles."

---

## Phase 1 — Project Setup & Auth

| # | Step | Files | Verify | Done when |
|---|------|-------|--------|-----------|
| 1.1 | Scaffold Next.js (App Router) + TypeScript, strict mode on | `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` | `npm run dev` serves a blank page; `npm run typecheck` clean | Fresh clone → `npm install && npm run dev` works with zero manual fixes |
| 1.2 | Configure Tailwind CSS | `tailwind.config.ts`, `postcss.config.js`, `globals.css` | A test div with a Tailwind class (e.g. `bg-red-500`) renders visibly | Utility classes apply on save without restart |
| 1.3 | Install & configure shadcn/ui | `components.json`, `src/components/ui/*` (button, input, card to start) | Render a shadcn `<Button>` on the home page | Component renders styled, no console errors |
| 1.4 | Supabase project + client utilities | `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server), `.env.example` | A server component successfully calls `supabase.auth.getSession()` without throwing | Both clients instantiate from env vars; no secrets in client bundle (check `next build` output) |
| 1.5 | Env var validation at startup | `src/lib/env.ts` (Zod schema for all required vars) | Delete one required var → app fails fast at boot with a clear message, not a runtime crash mid-request | Missing/malformed env var is caught before the server accepts traffic |
| 1.6 | Supabase Auth — email/password login, logout | `src/app/login/page.tsx`, `src/lib/supabase/auth.ts` | Manually sign up, log in, log out with a test account | Session persists across reload; logout actually clears session (verify in devtools) |
| 1.7 | Protected route middleware | `src/middleware.ts` | Hit `/dashboard` logged out → redirected to `/login`; hit it logged in → loads | Every route under `/dashboard`, `/jobs`, `/candidates`, `/settings` is protected, not just `/dashboard` |
| 1.8 | Basic dashboard shell (nav + empty stat cards) | `src/app/dashboard/page.tsx`, `src/components/dashboard/*` | Visual check — loads with placeholder zeros, responsive at mobile width | Nav links to all main sections exist even if pages are stubs |
| 1.9 | `/settings` page shell | `src/app/settings/page.tsx` | Visual check — logged-in user sees account email and a logout control | Route exists with real content (not a 404/blank stub) so the Phase 1.7 protection is guarding an actual page |

**Phase 1 exit check:** a new developer can clone, set env vars, sign up, and land on an empty dashboard — no half-wired features yet.

---

## Phase 2 — Job Creation & AI Analysis

| # | Step | Files | Verify | Done when |
|---|------|-------|--------|-----------|
| 2.1 | `jobs` table migration + RLS | `supabase/migrations/xxxx_jobs.sql` | Run migration; confirm via Supabase Studio that a second test user cannot `SELECT` another user's job | RLS policy blocks cross-user reads, not just writes |
| 2.2 | File text extraction utility | `src/lib/files/extract.ts` (pdf-parse for PDF, mammoth for DOCX, plain read for TXT) | Unit test with one sample file per type; confirm garbage/corrupt file returns a handled error, not a crash | 3 file types extract correctly; unsupported type returns a friendly error, not a 500 |
| 2.3 | `/jobs/new` page — paste or upload JD | `src/app/jobs/new/page.tsx` | Manually paste text → see it in the field; upload each file type → text populates | Switching between paste/upload doesn't lose data or throw |
| 2.4 | AIProvider abstraction + GeminiProvider | `src/lib/ai/AIProvider.ts`, `src/lib/ai/GeminiProvider.ts` | Call the provider directly with a hardcoded prompt in a script; confirm it returns text | Swapping providers requires changing one factory line, not call sites |
| 2.5 | Job-analysis prompt + Zod schema | `src/lib/ai/prompts/job-analysis.ts`, `src/types/job-analysis.ts` | Feed 2–3 real JDs (including the Transformation Excellence one from earlier) through it manually; confirm valid JSON every time | Zod schema rejects malformed AI output instead of silently passing bad data downstream |
| 2.6 | `POST /api/jobs/analyze` | `src/app/api/jobs/analyze/route.ts` | `curl` with a JD body → structured JSON response | Invalid/empty JD input returns a 4xx with a clear message, not a 500 |
| 2.7 | Display + edit extracted requirements | `src/components/jobs/RequirementsEditor.tsx` | Manually edit an extracted skill, remove one, add one | Edits are reflected in the payload sent to save, not just visually |
| 2.8 | Persist job + CRUD endpoints | `src/app/api/jobs/route.ts`, `src/app/api/jobs/[id]/route.ts` | Create a job, refresh the page, confirm it's still there; edit it; delete it | Full CRUD works and is scoped to the logged-in user (RLS holds under real requests, not just in Studio) |

**Phase 2 exit check:** a real JD goes in, structured requirements come out, get edited, and persist — end to end, no mock data.

---

## Phase 3 — Search Architecture

| # | Step | Files | Verify | Done when |
|---|------|-------|--------|-----------|
| 3.1 | `SearchProvider` interface + shared types | `src/lib/search/SearchProvider.ts`, `src/types/search.ts` | Typecheck only (no implementation yet) | Interface matches the shape agreed in the spec; no provider-specific fields leak into it |
| 3.2 | `MockSearchProvider` | `src/lib/search/MockSearchProvider.ts` | Call it directly → returns deterministic fixture candidates (5–10, varied completeness) | Fixtures deliberately include missing fields (no email, no company) so downstream code is forced to handle nulls |
| 3.3 | Provider selector via env var | `src/lib/search/index.ts` (factory) | Set `SEARCH_PROVIDER=mock`, confirm mock is used; change value, confirm error if provider unimplemented | Switching providers never requires touching calling code |
| 3.4 | Search-query-generation prompt | `src/lib/ai/prompts/search-query-generation.ts` | Feed the Phase 2 extracted requirements through it; confirm 2–4 sensible query variants | Generated queries are short (title + top skills + location), not full sentences |
| 3.5 | UI to review/edit generated queries | `src/components/jobs/SearchQueries.tsx` | Manually edit a query, delete one, add a custom one before running search | Edited queries are what actually get sent, not the original AI output |
| 3.6 | `search_queries` + `search_runs` tables | `supabase/migrations/xxxx_search.sql` (include a `credits_used` int column on `search_runs`) | Migration runs clean; insert a test row manually | Schema supports tracking cost per run from day one |
| 3.7 | `POST /api/jobs/:id/search` (mock-backed) | `src/app/api/jobs/[id]/search/route.ts` | Trigger a search run end-to-end using MockSearchProvider; confirm a `search_run` row and raw results are persisted | A full "Find Candidates" click produces persisted, queryable data — even before Phase 4 normalizes it |
| 3.8 | Real provider (SerpApiProvider or SerperProvider) | `src/lib/search/SerpApiProvider.ts` | Manual test with a real API key against one query; **expect sparse/noisy results** — this is normal, not a bug | Real provider implements the same interface with zero changes to calling code; falls back to a clear error if the key is missing, never silently to mock |
| 3.9 | `GET /api/search/:runId/status` | `src/app/api/search/[runId]/status/route.ts` | `curl` a running/completed run id → status (`pending`/`running`/`complete`/`error`), `total_results`, `credits_used` | Frontend can poll this endpoint to show search progress without blocking on the full run |

**Phase 3 exit check:** searches run against mock data reliably; the real provider is wired but stays optional/gated behind an env key.

---

## Phase 4 — Candidate System

| # | Step | Files | Verify | Done when |
|---|------|-------|--------|-----------|
| 4.1 | `candidates` + `candidate_matches` tables + RLS | `supabase/migrations/xxxx_candidates.sql` | Same cross-user RLS check as 2.1 | Confirmed no cross-user leakage |
| 4.2 | Normalization layer (deterministic, no AI) | `src/lib/candidates/normalize.ts` | Unit test: feed a raw MockSearchProvider result, confirm output matches `NormalizedCandidate` shape with nulls where data is missing | Never fabricates a field the source didn't provide. Deliberate deviation from the spec's AI Prompt Architecture section (which lists a `candidate-normalization.ts` prompt): decided with user to keep normalization pure field-mapping, no AI involved, to eliminate fabrication risk entirely |
| 4.3 | Duplicate detection | `src/lib/candidates/dedupe.ts` | Unit test: same `profile_url` twice → 1 record; same name+company, no URL → 1 record; different candidates → 2 records | False-positive dedupe (merging two different people) is treated as a worse bug than a missed duplicate |
| 4.4 | Persist normalized/deduped candidates | wired into `/api/jobs/:id/search` route | Run a search, confirm candidate rows exist, re-run the same search, confirm no duplicate rows were added | Re-running a search is idempotent for identical results |
| 4.5 | Candidate read endpoints | `src/app/api/jobs/[id]/candidates/route.ts`, `src/app/api/candidates/[id]/route.ts` | `curl` both, confirm shape matches frontend expectations | Pagination params work (`?page=`, `?limit=`) |
| 4.6 | Candidate dashboard table UI | `src/app/candidates/page.tsx` | Visual check with seeded data (10+ candidates) | Table renders correctly with missing fields (no company, no location) without layout breaking |
| 4.7 | Filters, sorting, pagination | `src/components/candidates/Filters.tsx` | Manually filter by each field, sort each direction, page through results | Filters combine correctly (AND, not overriding each other) |
| 4.8 | Candidate profile page + status/notes | `src/app/candidates/[id]/page.tsx`, `src/app/api/candidates/[id]/status/route.ts`, `.../notes/route.ts` | Change status, add a note, refresh, confirm both persisted | Status history is recorded (`candidate_status_history`), not just overwritten |

**Phase 4 exit check:** candidates from a search run are viewable, filterable, and manageable — before any AI scoring exists.

---

## Phase 5 — AI Matching

| # | Step | Files | Verify | Done when |
|---|------|-------|--------|-----------|
| 5.1 | Candidate-matching prompt + Zod schema | `src/lib/ai/prompts/candidate-matching.ts`, `src/types/matching.ts` | Manually score 2–3 real candidates against the Transformation Excellence JD; confirm scores look defensible, not arbitrary | Every sub-score (skills/experience/location/education/seniority) is traceable to explicit criteria the prompt was given |
| 5.2 | `POST /api/candidates/match` (single) | `src/app/api/candidates/match/route.ts` | `curl` one candidate + job → full score breakdown JSON | Malformed AI output is caught by Zod, not silently persisted |
| 5.3 | Batch matching for a search run | wired into search-run flow or a separate trigger endpoint | Run on 10+ candidates, confirm all get `candidate_matches` rows, confirm partial failure (1 bad candidate) doesn't kill the whole batch | One candidate's AI error doesn't block the other 9 |
| 5.4 | Display match score + breakdown | dashboard table + profile page | Visual check — score badge on table, full breakdown on profile page | Matched/missing requirements and strengths/concerns are visible, not just the top-line % |
| 5.5 | Sort/filter by match score | extend 4.7's filter component | Sort high→low and low→high | Default dashboard sort is high→low match |

**Phase 5 exit check:** every candidate in a search run has a defensible, explained match score.

---

## Phase 6 — Excel Export

| # | Step | Files | Verify | Done when |
|---|------|-------|--------|-----------|
| 6.1 | Excel export utility (SheetJS) | `src/lib/export/excel.ts` | Unit test: build a workbook from 3 fixture candidates, confirm it parses back with SheetJS | Columns: Name, Headline, Company, Location, Experience, Skills, Match Score, Skills Score, Experience Score, Location Score, Education Score, Seniority Score, Matched Requirements, Missing Requirements, AI Summary, Source, Profile URL, Status, Recruiter Notes, Date Added (Education Score added beyond the spec's literal list, for consistency with the on-screen match breakdown — confirmed with user) |
| 6.2 | `GET /api/jobs/:id/export` | `src/app/api/jobs/[id]/export/route.ts` | Hit the endpoint with active filters in the query string, confirm the exported rows match the filtered dashboard view, not the full unfiltered set | Export always reflects what the recruiter is currently looking at |
| 6.3 | "Export Excel" button | `src/components/jobs/ExportButton.tsx` | Click it, confirm file downloads with name `candidates-{job-slug}-{date}.xlsx` | Filename is dynamic, not hardcoded |
| 6.4 | Formatting polish | same file as 6.1 | Open the exported file in Excel *and* LibreOffice/Google Sheets | Column widths are readable without manual resizing; no raw JSON blobs dumped into cells |

**Phase 6 exit check:** a recruiter can filter candidates, export, and open a clean spreadsheet — no broken cells, no technical fields leaking in.

---

## Phase 7 — Production Hardening

| # | Step | Files | Verify | Done when |
|---|------|-------|--------|-----------|
| 7.1 | Centralized error handling | `src/lib/errors.ts`, applied across API routes | Force each documented error case (invalid JD, unsupported file, AI error, search error, rate limit, timeout, duplicate, invalid AI JSON, DB error, export error) | No stack trace, API key, or internal path ever reaches a client response |
| 7.2 | Rate limiting service layer | `src/lib/rate-limit.ts` (in-memory stub now, Upstash-ready interface) | Hit an endpoint past a low test threshold, confirm a 429 with a clear message | Swapping the stub for real Upstash later requires no call-site changes |
| 7.3 | Background job scaffold for search runs | `src/lib/jobs/queue.ts` (simple in-process queue, swappable) | Trigger a search run, confirm the UI doesn't block/hang while it processes | Progress is visible (status: pending/running/complete/error) even with the simple MVP queue |
| 7.4 | Retry logic for AI/search calls | wrapped in `src/lib/ai/` and `src/lib/search/` clients | Simulate a transient failure (e.g. force a timeout), confirm it retries with backoff before failing | Retries are capped (no infinite retry loop) and logged |
| 7.5 | Structured logging with correlation IDs | `src/lib/logger.ts`, applied across API routes | Trigger a request, confirm one correlation ID traces through all related log lines | A single failed request can be traced end-to-end from one ID |
| 7.6 | Loading/empty/error/skeleton audit | across all pages | Manually trigger each state (slow network, zero results, forced error) on every page | No page shows a blank white screen or unhandled spinner forever |
| 7.7 | Cascade delete on job/candidate deletion (referential integrity, not a policy) | delete endpoints cascade `candidates`/`candidate_matches`/`candidate_notes`/`candidate_status_history` on job or candidate deletion | Delete a job, confirm all associated rows are removed, no orphans left in any table | Deleting a job or candidate leaves zero orphaned rows |
| 7.8 | Data retention/deletion policy (documentation only — do not implement yet) | `docs/data-retention.md` | Doc exists and is explicit: legal basis for storing candidate data, proposed retention window, how a removal request would be honored — marked **"not implemented — required before production"** | The Phase-2 backlog item is written down and impossible to miss, but nothing is auto-built from it in this phase |

**Phase 7 exit check:** the app survives real failure modes (bad input, provider outages, rate limits) without leaking internals or hanging silently.

---

## Working agreement (for Claude Code, per step)

1. Implement the step.
2. Run: `npm run typecheck && npm run lint && npm run test` (add the specific Verify check from the table).
3. Fix everything red before reporting done.
4. Summarize: what changed, how it was verified, anything deferred.
5. Stop and wait for confirmation before starting the next step.
