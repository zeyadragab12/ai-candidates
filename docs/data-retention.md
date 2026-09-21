# Data Retention & Deletion Policy

> **Status: NOT IMPLEMENTED — required before production.**
> Everything below is a proposal to be reviewed and approved (by whoever owns
> legal/compliance for this product) before launch. Nothing in this
> document is auto-enforced by the application today. Candidate data
> currently persists indefinitely once created, with deletion only possible
> manually via the existing `DELETE /api/candidates/:id` and
> `DELETE /api/jobs/:id` endpoints (see [step 7.7](../PROJECT_PLAN.md)),
> which a recruiter must trigger themselves, one record at a time.

## What data this covers

The platform stores personal data about real people who never
consented to being in this system — they were found via public web
search, not through an application process. This is the core reason
retention needs an explicit, written policy rather than "keep
everything forever": every additional day a candidate's name, work
history, and profile URL sit in this database without a documented
reason is added legal exposure, not added value.

Data in scope:

- `candidates` (name, headline, company, location, profile URL, skills,
  experience, AI-written summary, raw source payload)
- `candidate_matches` (AI-generated scoring/commentary tied to a candidate
  and a job)
- `candidate_notes` (free-text notes a recruiter wrote about a candidate —
  potentially the most sensitive table, since a recruiter could paste
  anything here)
- `candidate_status_history` (audit trail of status changes)
- `search_runs.raw_results` (raw provider search payloads, which contain
  the same candidate PII before normalization)

Out of scope: `jobs` and `search_queries`, which describe the recruiter's
own work product, not a third party's personal data.

## Legal basis for storing candidate data

Candidates sourced via public search have not consented to being
profiled or contacted. The working assumption is that the applicable
legal basis is **legitimate interest** (recruiting for a specific role),
which — under frameworks like GDPR — requires that:

1. the processing is necessary for that specific, stated purpose (sourcing
   candidates for an active job requisition),
2. the data kept is proportionate to that purpose (no more fields, no
   longer, than the recruiting purpose justifies), and
3. the individual's rights (access, correction, deletion/objection) are
   honored on request.

**This has not been reviewed by legal counsel.** Depending on the
jurisdictions of the candidates being sourced (this matters a lot for
EU/UK/California-based candidates specifically), a different legal basis
or additional safeguards (e.g. a documented legitimate-interest
assessment, a public-facing privacy notice) may be required. Legal
sign-off on this section is a prerequisite for production, not this
document.

## Proposed retention windows

| Data | Proposed window | Rationale |
|---|---|---|
| Candidates with no `status` change and no note, never linked to an active job's search results | 90 days from `created_at` | If a candidate was found but never engaged with, there's no ongoing purpose served by keeping their data. |
| Candidates with recruiter activity (a note, a status change, or `status` other than `New`) | 12 months from the *last* activity (`updated_at`, or the latest `candidate_notes`/`candidate_status_history` row) | An active or recently-considered candidate may reasonably be revisited within a hiring cycle. |
| `candidate_status_history` / `candidate_notes` | Same lifetime as their parent candidate row (cascade-deleted with it — already enforced at the DB level, see step 7.7) | These only have meaning attached to a candidate; no standalone retention need. |
| `search_runs.raw_results` (raw provider payloads) | 30 days from the search run's `completed_at`, then null out the column (keep the run's own metadata — status, counts, `credits_used` — for the recruiter's own audit trail) | This is the least-processed, highest-PII-density copy of candidate data; it should be the first thing dropped once normalization into `candidates` has happened. |
| A rejected job requisition and everything found only for it | 6 months from job deletion/closure | Matches typical recruiting-process record-keeping norms; open to adjustment per company policy. |

These are starting proposals, not final numbers — they should be set by
whoever owns compliance for this product, informed by the jurisdictions
being sourced from and any applicable industry regulation.

## How a deletion request would be honored

If a candidate found by this tool were to ask for their data to be
removed (a data-subject deletion/erasure request), the process today
would be:

1. Locate the candidate by name/profile URL across the `candidates` table
   (there is currently no cross-user search — a request would need to be
   checked against every recruiter's data individually, since RLS scopes
   candidates per-recruiter by design).
2. Call `DELETE /api/candidates/:id` for each matching row. This already
   cascades to `candidate_matches`, `candidate_notes`, and
   `candidate_status_history` for that candidate (step 7.7), so no manual
   cleanup of dependent tables is needed.
3. Check `search_runs.raw_results` (jsonb) on any run that may have
   surfaced this candidate, and redact/null the matching entries — this is
   **not currently automated** and would need a manual query today.

**Gaps to close before this is production-ready:**
- No self-serve way for a candidate to submit a deletion request (would
  need some public intake, e.g. an email alias or form, with identity
  verification).
- No automated sweep enforcing the retention windows above — someone
  would have to run this by hand today.
- No redaction tooling for `search_runs.raw_results` — it's a jsonb blob,
  not currently indexed by candidate identity.

## Recommended next steps (not built yet)

- A scheduled job (cron/Supabase Edge Function) that enforces the
  retention windows above automatically, once they're approved.
- A `deletion_requests` table + minimal intake flow, so a request has an
  audit trail (who asked, when, what was found and removed).
- Structured extraction of `search_runs.raw_results` into normalized
  columns (or removing it entirely once `candidates` rows exist), so raw
  PII doesn't linger in a jsonb blob nobody is scanning.
