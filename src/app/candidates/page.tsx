"use client";

import { Briefcase, ExternalLink, Eye, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DashboardNav } from "@/components/dashboard/nav";
import {
  Filters,
  DEFAULT_CANDIDATE_FILTERS,
  type CandidateFilterState,
} from "@/components/candidates/Filters";
import { SkillsCell } from "@/components/candidates/SkillsCell";
import { ExportButton } from "@/components/jobs/ExportButton";
import { Avatar } from "@/components/ui/avatar";
import { Badge, matchScoreTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyCell } from "@/components/ui/empty-cell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { CANDIDATE_STATUSES } from "@/lib/candidates/statuses";

const PAGE_SIZE = 10;

function buildFilterQueryString(filters: CandidateFilterState): string {
  const params = new URLSearchParams();
  if (filters.name) params.set("name", filters.name);
  if (filters.skill) params.set("skill", filters.skill);
  if (filters.location) params.set("location", filters.location);
  if (filters.company) params.set("company", filters.company);
  if (filters.status) params.set("status", filters.status);
  params.set("sort_by", filters.sortBy);
  params.set("sort_dir", filters.sortDir);
  return params.toString();
}

function buildQueryString(filters: CandidateFilterState, page: number): string {
  const params = new URLSearchParams(buildFilterQueryString(filters));
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));
  return params.toString();
}

interface Job {
  id: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  created_at: string;
}

interface Candidate {
  id: string;
  name: string | null;
  company: string | null;
  location: string | null;
  experience_years: number | null;
  skills: string[];
  source: string;
  profile_url: string | null;
  profile_image_url: string | null;
  status: string;
  created_at: string;
  match: { match_score: number } | null;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })} · ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function JobPicker() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    fetch("/api/jobs")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error ?? "Failed to load jobs.");
          return;
        }
        setJobs(data.jobs ?? []);
      })
      .catch(() => setLoadError("Failed to load jobs."))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleDeleteJob(jobId: string) {
    setDeleteError(null);
    setDeletingId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Failed to delete job.";
        setDeleteError(msg);
        toast.error(msg, "Delete Failed");
        return;
      }
      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      toast.success("Job and its listing removed.", "Job Deleted");
    } catch {
      setDeleteError("Failed to delete job.");
      toast.error("Failed to delete job.");
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading jobs...</p>;
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {loadError}
      </p>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Briefcase className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-foreground">
          No jobs yet.{" "}
          <Link href="/jobs/new" className="font-medium text-primary underline">
            Create a job
          </Link>{" "}
          to start finding candidates.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="job-picker">
      {deleteError && (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      )}
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between"
          data-testid="job-picker-row"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Briefcase className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{job.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{formatDateTime(job.created_at)}</span>
                {job.location && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{job.location}</span>
                  </>
                )}
                {job.employment_type && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{job.employment_type}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {pendingDeleteId === job.id ? (
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              <span className="text-xs text-muted-foreground">Delete this job?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deletingId === job.id}
                onClick={() => handleDeleteJob(job.id)}
                data-testid="confirm-delete-job"
              >
                {deletingId === job.id ? "Deleting..." : "Confirm"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletingId === job.id}
                onClick={() => setPendingDeleteId(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <Button asChild type="button" variant="outline" size="sm" className="gap-1.5">
                <Link href={`/candidates?jobId=${job.id}`}>
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  View
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setPendingDeleteId(job.id)}
                aria-label={`Delete ${job.title}`}
                data-testid="delete-job-button"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CandidatesTable({ jobId }: { jobId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<CandidateFilterState>(
    DEFAULT_CANDIDATE_FILTERS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [isScoring, setIsScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreSummary, setScoreSummary] = useState<{
    total: number;
    succeeded: number;
    failed: number;
  } | null>(null);

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    const query = buildQueryString(filters, page);
    fetch(`/api/jobs/${jobId}/candidates?${query}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load candidates.");
          return;
        }
        setCandidates(data.candidates ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to load candidates.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [jobId, filters, page, refreshToken]);

  function handleFiltersChange(updated: CandidateFilterState) {
    setFilters(updated);
    setPage(1);
  }

  async function handleStatusChange(candidateId: string, status: string) {
    setStatusError(null);
    setUpdatingStatusId(candidateId);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Failed to update status.";
        setStatusError(msg);
        toast.error(msg, "Status Update Failed");
        return;
      }
      setCandidates((prev) =>
        prev.map((candidate) =>
          candidate.id === candidateId ? { ...candidate, status } : candidate,
        ),
      );
      toast.success(`Candidate status marked as "${status}"`, "Status Updated");
    } catch {
      setStatusError("Failed to update status.");
      toast.error("Failed to update status.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleDeleteCandidate(candidateId: string) {
    setDeleteError(null);
    setDeletingId(candidateId);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Failed to delete candidate.";
        setDeleteError(msg);
        toast.error(msg, "Delete Failed");
        return;
      }
      setCandidates((prev) => prev.filter((candidate) => candidate.id !== candidateId));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success("Candidate removed from this job.", "Candidate Deleted");
    } catch {
      setDeleteError("Failed to delete candidate.");
      toast.error("Failed to delete candidate.");
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  }

  async function handleScoreCandidates() {
    setIsScoring(true);
    setScoreError(null);
    setScoreSummary(null);
    toast.info("Evaluating all candidate profiles against job requirements...", "Batch Matching");

    try {
      const res = await fetch(`/api/jobs/${jobId}/match`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error ?? "Failed to score candidates.";
        setScoreError(msg);
        toast.error(msg, "Match Scoring Failed");
        return;
      }

      setScoreSummary(data);
      setRefreshToken((t) => t + 1);
      toast.success(`Scored ${data.succeeded} candidates successfully!`, "Match Scoring Completed");
    } catch {
      setScoreError("Failed to score candidates.");
      toast.error("Failed to score candidates.");
    } finally {
      setIsScoring(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtersUi = (
    <Filters value={filters} onChange={handleFiltersChange} />
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {filtersUi}
        <p className="text-sm text-muted-foreground">Loading candidates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {filtersUi}
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filtersUi}

      {total > 0 && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleScoreCandidates}
            disabled={isScoring}
            className="self-start"
            data-testid="score-candidates-button"
          >
            {isScoring ? "Scoring..." : "Score Candidates"}
          </Button>
          {scoreError && (
            <p role="alert" className="text-sm text-destructive">
              {scoreError}
            </p>
          )}
          {scoreSummary && (
            <p className="text-sm text-muted-foreground" data-testid="score-summary">
              Scored {scoreSummary.succeeded} of {scoreSummary.total} candidates
              {scoreSummary.failed > 0 ? ` (${scoreSummary.failed} failed)` : ""}.
            </p>
          )}
        </div>
      )}

      {statusError && (
        <p role="alert" className="text-sm text-destructive">
          {statusError}
        </p>
      )}

      {deleteError && (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      )}

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Users className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">No candidates match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1080px] text-sm" data-testid="candidates-table">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-12 p-3 font-medium text-right">#</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Location</th>
                <th className="p-3 font-medium">Skills</th>
                <th className="p-3 font-medium">Match</th>
                <th className="p-3 font-medium">Date Added</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Profile</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate, index) => (
                <tr
                  key={candidate.id}
                  className="border-b border-border/70 last:border-0 hover:bg-accent/40 even:bg-muted/20"
                  data-testid="candidate-row"
                >
                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + index + 1}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/candidates/${candidate.id}?jobId=${jobId}`}
                      className="flex items-center gap-2.5 font-medium text-foreground no-underline transition-colors hover:text-primary focus-visible:text-primary"
                    >
                      <Avatar
                        src={candidate.profile_image_url}
                        alt={candidate.name ?? "Unnamed candidate"}
                        className="h-8 w-8"
                      />
                      {candidate.name ?? "Unnamed candidate"}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {candidate.location ?? <EmptyCell />}
                  </td>
                  <td className="p-3">
                    <SkillsCell skills={candidate.skills} />
                  </td>
                  <td className="p-3">
                    {candidate.match ? (
                      <Badge tone={matchScoreTone(candidate.match.match_score)}>
                        {candidate.match.match_score}%
                      </Badge>
                    ) : (
                      <EmptyCell />
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(candidate.created_at)}
                  </td>
                  <td className="p-3">
                    <Select
                      value={candidate.status}
                      onValueChange={(status) => handleStatusChange(candidate.id, status)}
                      disabled={updatingStatusId === candidate.id}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs" data-testid="status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CANDIDATE_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    {candidate.profile_url ? (
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <a href={candidate.profile_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          View
                        </a>
                      </Button>
                    ) : (
                      <EmptyCell />
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {pendingDeleteId === candidate.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs text-muted-foreground">Delete?</span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === candidate.id}
                          onClick={() => handleDeleteCandidate(candidate.id)}
                          data-testid="confirm-delete-candidate"
                        >
                          {deletingId === candidate.id ? "Deleting..." : "Confirm"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deletingId === candidate.id}
                          onClick={() => setPendingDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary"
                          aria-label={`View ${candidate.name ?? "candidate"}`}
                          data-testid="view-candidate-button"
                        >
                          <Link href={`/candidates/${candidate.id}?jobId=${jobId}`}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingDeleteId(candidate.id)}
                          aria-label={`Delete ${candidate.name ?? "candidate"}`}
                          data-testid="delete-candidate-button"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="pagination-summary">
          Page {page} of {totalPages} ({total} total)
        </p>
        <div className="flex gap-2">
          <ExportButton jobId={jobId} queryString={buildFilterQueryString(filters)} />
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            data-testid="pagination-prev"
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            data-testid="pagination-next"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function CandidatesPageContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  return (
    <main className="min-h-screen">
      <DashboardNav />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Candidates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, score, and shortlist sourced candidates.
          </p>
        </div>

        {!jobId ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Select a job</CardTitle>
            </CardHeader>
            <CardContent>
              <JobPicker />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Candidates for this job</CardTitle>
            </CardHeader>
            <CardContent>
              <CandidatesTable jobId={jobId} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function CandidatesPageSkeleton() {
  return (
    <main className="min-h-screen">
      <DashboardNav />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Candidates
        </h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </main>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<CandidatesPageSkeleton />}>
      <CandidatesPageContent />
    </Suspense>
  );
}
