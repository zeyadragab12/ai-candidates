import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { requireUser } from "@/lib/api/requireUser";
import { getSearchProvider } from "@/lib/search";
import { getEnrichmentProvider } from "@/lib/enrichment";
import { extractLinkedInSlug } from "@/lib/enrichment/ApifyLinkedInProvider";
import { getAIProvider } from "@/lib/ai";
import { normalizeCandidate } from "@/lib/candidates/normalize";
import { dedupeCandidates, getCandidateIdentityKey } from "@/lib/candidates/dedupe";
import { isImplausibleCompany, isImplausibleExperienceYears } from "@/lib/candidates/dataQuality";
import { resolveEgyptSearchLocation, type SerpApiLocationParams } from "@/lib/candidates/locationBias";
import { filterToEgyptCandidates } from "@/lib/candidates/verifyEgyptLocation";
import { persistCandidates } from "@/lib/candidates/persist";
import { withErrorHandling } from "@/lib/errors";
import { getJobQueue } from "@/lib/jobs/queue";
import { createLogger, getOrCreateRequestId, type RequestLogger } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { CandidateSearchResult } from "@/types/search";
import type { NormalizedCandidate } from "@/types/candidate";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const requestSchema = z.object({
  queries: z
    .array(z.string().trim().min(1))
    .min(1, "At least one search query is required."),
});

/**
 * Does the actual search work: runs after the HTTP response has already
 * been sent (see getJobQueue), so the client never blocks on it. Progress
 * is visible the whole time via GET /api/search/:runId/status, which just
 * reads search_runs.status (pending -> running -> complete/error).
 */
async function processSearchRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  jobId: string,
  runId: string,
  queries: string[],
  provider: string,
  searchLocation: SerpApiLocationParams,
  logger: RequestLogger,
): Promise<void> {
  logger.info("Search run started", { jobId, runId, provider, queryCount: queries.length });

  await supabase
    .from("search_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);

  const { error: createQueriesError } = await supabase
    .from("search_queries")
    .insert(queries.map((query) => ({ job_id: jobId, query, provider })));

  if (createQueriesError) {
    logger.error("Search run failed: could not save search queries", {
      jobId,
      runId,
      error: createQueriesError,
    });
    await supabase
      .from("search_runs")
      .update({
        status: "error",
        error: "Failed to save search queries.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return;
  }

  const searchProvider = getSearchProvider();
  let allResults: CandidateSearchResult[] = [];
  const queryErrors: string[] = [];

  // Queries are independent, so run them concurrently rather than paying
  // each one's latency (and retries) back to back.
  const settled = await Promise.allSettled(
    queries.map((query) => searchProvider.searchCandidates({ query, ...searchLocation })),
  );
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      allResults.push(...outcome.value);
      return;
    }
    const error = outcome.reason;
    logger.warn("Search query failed", { jobId, runId, query: queries[index], error });
    queryErrors.push(error instanceof Error ? error.message : "Unknown search error");
  });

  // Enrich LinkedIn profile URLs SerpApi already discovered via Apify's
  // LinkedIn Profile Scraper, filling in real profile data (headline,
  // company, location, skills, tenure) before OpenAI ever sees the
  // candidate. Apify is never used for discovery, only enrichment — and it's
  // entirely optional (getEnrichmentProvider() returns null when unconfigured),
  // so a search run behaves exactly as before when it's off. A failure here
  // is logged and surfaced in search_runs.error but never aborts the run:
  // candidates still get persisted with SerpApi-only data, matching how a
  // failed search query is handled above.
  const enrichmentProvider = getEnrichmentProvider();
  if (enrichmentProvider) {
    const linkedInProfileUrls = Array.from(
      new Set(
        allResults
          .map((result) => result.profile_url)
          .filter((url): url is string => !!url && /linkedin\.com\/in\//i.test(url)),
      ),
    );

    if (linkedInProfileUrls.length > 0) {
      try {
        const enrichedBySlug = await enrichmentProvider.enrichProfiles(linkedInProfileUrls);
        allResults = allResults.map((result) => {
          const slug = result.profile_url ? extractLinkedInSlug(result.profile_url) : null;
          const enrichment = slug ? enrichedBySlug.get(slug) : undefined;
          if (!enrichment) return result;

          return {
            ...result,
            name: enrichment.name ?? result.name,
            title: enrichment.headline ?? result.title,
            company: enrichment.currentCompany ?? result.company,
            location: enrichment.location ?? result.location,
            snippet: enrichment.about ?? result.snippet,
            skills: enrichment.skills?.length ? enrichment.skills : result.skills,
            experience_years: enrichment.experienceYears ?? result.experience_years,
            profile_image_url: enrichment.profileImageUrl ?? result.profile_image_url,
          };
        });
        logger.info("LinkedIn enrichment complete", {
          jobId,
          runId,
          profilesRequested: linkedInProfileUrls.length,
          profilesEnriched: enrichedBySlug.size,
        });
      } catch (error) {
        logger.warn("LinkedIn enrichment failed; continuing with SerpApi-only data", {
          jobId,
          runId,
          error,
        });
        queryErrors.push(
          error instanceof Error
            ? `LinkedIn enrichment: ${error.message}`
            : "LinkedIn enrichment failed",
        );
      }
    }
  }

  if (allResults.length === 0 && queryErrors.length > 0) {
    logger.error("Search run failed: all queries failed", { jobId, runId });
    await supabase
      .from("search_runs")
      .update({
        status: "error",
        error: queryErrors.join("; "),
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return;
  }

  // Nationwide Egypt sourcing needs candidates actually confirmed to be
  // based there — SerpApi/Apify location data isn't always reliable, and
  // the query text alone (even quoted) doesn't guarantee it either. Only
  // runs when this job's location resolved to Egypt; every other job's
  // results are never touched by this. Fails soft (never aborts the run),
  // matching the enrichment step's pattern above.
  if (searchLocation.countryCode === "eg") {
    try {
      const beforeCount = allResults.length;
      allResults = await filterToEgyptCandidates(allResults, getAIProvider());
      logger.info("Egypt location verification complete", {
        jobId,
        runId,
        before: beforeCount,
        after: allResults.length,
      });
    } catch (error) {
      logger.warn("Egypt location verification failed; continuing without it", {
        jobId,
        runId,
        error,
      });
    }
  }

  // Defensive validation layer: reject a company/experience value that
  // implausibly matches our own recruiting company rather than ever
  // displaying it on a candidate. Applied to every result (SerpApi
  // title-parsing and Apify enrichment alike) right before normalization —
  // a value dropped here is never guessed or replaced, just left absent
  // like any other field the providers didn't actually give us.
  allResults = allResults.map((result) => ({
    ...result,
    company: isImplausibleCompany(result.company) ? undefined : result.company,
    experience_years: isImplausibleExperienceYears(result.experience_years)
      ? undefined
      : result.experience_years,
  }));

  // Normalize + dedupe raw results, tracking which raw result each
  // normalized candidate came from so it can be stored as raw_data for
  // traceability (best-effort: for merged duplicates, this is the first
  // raw result observed for that identity, matching dedupe's own
  // "existing wins" merge philosophy).
  const referenceToRaw = new Map<NormalizedCandidate, CandidateSearchResult>();
  const identityKeyToRaw = new Map<string, CandidateSearchResult>();
  const normalized: NormalizedCandidate[] = [];

  for (const raw of allResults) {
    const candidate = normalizeCandidate(raw);
    normalized.push(candidate);
    referenceToRaw.set(candidate, raw);
    const key = getCandidateIdentityKey(candidate);
    if (key && !identityKeyToRaw.has(key)) {
      identityKeyToRaw.set(key, raw);
    }
  }

  const dedupedCandidates = dedupeCandidates(normalized);

  const rawDataByCandidate = new Map<NormalizedCandidate, unknown>();
  for (const candidate of dedupedCandidates) {
    const raw =
      referenceToRaw.get(candidate) ??
      (() => {
        const key = getCandidateIdentityKey(candidate);
        return key ? identityKeyToRaw.get(key) : undefined;
      })();
    if (raw) rawDataByCandidate.set(candidate, raw);
  }

  const persisted = await persistCandidates(
    supabase,
    userId,
    dedupedCandidates,
    rawDataByCandidate,
  );
  const newCandidateCount = persisted.filter((p) => p.isNew).length;

  let jobCandidatesLinkError: string | null = null;
  if (persisted.length > 0) {
    const { error } = await supabase.from("job_candidates").upsert(
      persisted.map((p) => ({ job_id: jobId, candidate_id: p.id, search_run_id: runId })),
      { onConflict: "job_id,candidate_id", ignoreDuplicates: true },
    );
    if (error) jobCandidatesLinkError = "Failed to link some candidates to this job.";
  }

  // Mock provider is free; real providers (step 3.8) will report actual cost.
  const creditsUsed = provider === "mock" ? 0 : queries.length;

  await supabase
    .from("search_runs")
    .update({
      status: "complete",
      total_results: allResults.length,
      raw_results: allResults,
      candidates_found: dedupedCandidates.length,
      candidates_new: newCandidateCount,
      credits_used: creditsUsed,
      completed_at: new Date().toISOString(),
      error:
        [
          queryErrors.length > 0 ? queryErrors.join("; ") : null,
          jobCandidatesLinkError,
        ]
          .filter(Boolean)
          .join("; ") || null,
    })
    .eq("id", runId);

  logger.info("Search run complete", {
    jobId,
    runId,
    totalResults: allResults.length,
    candidatesFound: dedupedCandidates.length,
    candidatesNew: newCandidateCount,
  });
}

export const POST = withErrorHandling(async (
  request: Request,
  { params }: RouteParams,
  logger: RequestLogger = createLogger("no-request-id"),
) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id: jobId } = await params;

  await enforceRateLimit(
    `search:${auth.user.id}`,
    RATE_LIMITS.searchRequest.limit,
    RATE_LIMITS.searchRequest.windowSeconds,
  );

  const job = await supabase
    .from("jobs")
    .select("id, location, country")
    .eq("id", jobId)
    .maybeSingle();

  if (job.error) {
    return NextResponse.json({ error: "Failed to load job." }, { status: 500 });
  }
  if (!job.data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  // Non-geographic values ("Remote", "Global", etc.) must never bias
  // SerpApi's geo-targeted search — see resolveEgyptSearchLocation's doc
  // comment. This is separate from job.location itself, which is left
  // untouched (still shown/editable everywhere else). job.country (the
  // specific city, e.g. "Cairo") overrides the `location` param when set,
  // narrowing the nationwide "Egypt" targeting down to that city while
  // keeping the same gl=eg/google_domain country-level params.
  const searchLocation = resolveEgyptSearchLocation(job.data.location);
  if (job.data.country) {
    searchLocation.location = job.data.country;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { queries } = parsed.data;

  const provider = env.SEARCH_PROVIDER;

  const { data: run, error: createRunError } = await supabase
    .from("search_runs")
    .insert({
      job_id: jobId,
      provider,
      status: "pending",
      created_by: auth.user.id,
      created_by_email: auth.user.email,
    })
    .select()
    .single();

  if (createRunError || !run) {
    return NextResponse.json(
      { error: "Failed to start search run." },
      { status: 500 },
    );
  }

  // Enqueued, not awaited: the response below is sent immediately, and the
  // client tracks progress via GET /api/search/:runId/status. The request's
  // correlation id is passed through so background log lines can be tied
  // back to the request that started them.
  getJobQueue().enqueue(async () => {
    try {
      await processSearchRun(
        supabase,
        auth.user.id,
        jobId,
        run.id,
        queries,
        provider,
        searchLocation,
        logger,
      );
    } catch (error) {
      // Without this, an unexpected throw (e.g. in persistCandidates)
      // leaves the run at "running" forever and the client polls until it
      // gives up.
      logger.error("Search run failed unexpectedly", { jobId, runId: run.id, error });
      await supabase
        .from("search_runs")
        .update({
          status: "error",
          error: "Search failed unexpectedly. Please try again.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }
  }, getOrCreateRequestId(request));

  return NextResponse.json(run, { status: 202 });
});
