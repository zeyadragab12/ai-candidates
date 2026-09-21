"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { DashboardNav } from "@/components/dashboard/nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { matchScoreTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyCell } from "@/components/ui/empty-cell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CANDIDATE_STATUSES = [
  "New",
  "Reviewed",
  "Shortlisted",
  "Rejected",
  "Contacted",
] as const;

interface Match {
  match_score: number;
  skills_score: number | null;
  experience_score: number | null;
  location_score: number | null;
  education_score: number | null;
  seniority_score: number | null;
  matched_requirements: string[];
  missing_requirements: string[];
  strengths: string[];
  concerns: string[];
  ai_summary: string | null;
}

interface Candidate {
  id: string;
  name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  profile_url: string | null;
  source: string;
  summary: string | null;
  skills: string[];
  experience_years: number | null;
  status: string;
  match: Match | null;
}

interface Note {
  id: string;
  note: string;
  created_at: string;
}

function CandidateProfileContent() {
  const params = useParams<{ id: string }>();
  const candidateId = params.id;
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [noteDraft, setNoteDraft] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  async function loadAll() {
    setIsLoading(true);
    setError(null);
    try {
      const candidateUrl = jobId
        ? `/api/candidates/${candidateId}?jobId=${jobId}`
        : `/api/candidates/${candidateId}`;
      const [candidateRes, notesRes] = await Promise.all([
        fetch(candidateUrl),
        fetch(`/api/candidates/${candidateId}/notes`),
      ]);
      const candidateData = await candidateRes.json();
      const notesData = await notesRes.json();

      if (!candidateRes.ok) {
        setError(candidateData.error ?? "Failed to load candidate.");
        return;
      }
      setCandidate(candidateData);
      setNotes(notesData.notes ?? []);
    } catch {
      setError("Failed to load candidate.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, jobId]);

  async function handleStatusChange(status: string) {
    if (!candidate) return;
    setStatusError(null);
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error ?? "Failed to update status.");
        return;
      }
      setCandidate(data);
    } catch {
      setStatusError("Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleAddNote() {
    if (!noteDraft.trim()) return;
    setNoteError(null);
    setIsSavingNote(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNoteError(data.error ?? "Failed to save note.");
        return;
      }
      setNotes((prev) => [data, ...prev]);
      setNoteDraft("");
    } catch {
      setNoteError("Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <DashboardNav />
        <p className="p-4 text-sm text-muted-foreground">Loading candidate...</p>
      </main>
    );
  }

  if (error || !candidate) {
    return (
      <main className="min-h-screen">
        <DashboardNav />
        <p role="alert" className="p-4 text-sm text-destructive">
          {error ?? "Candidate not found."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <DashboardNav />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:py-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {candidate.name ?? "Unnamed candidate"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {candidate.headline && (
              <p className="text-base text-foreground">{candidate.headline}</p>
            )}
            {(candidate.company || candidate.location) && (
              <p className="text-muted-foreground">
                {[candidate.company, candidate.location].filter(Boolean).join(" · ")}
              </p>
            )}
            <p>
              Experience:{" "}
              {candidate.experience_years !== null ? (
                `${candidate.experience_years} yrs`
              ) : (
                <EmptyCell />
              )}
            </p>
            <p>
              Skills:{" "}
              {candidate.skills.length > 0 ? candidate.skills.join(", ") : <EmptyCell />}
            </p>
            <p>Source: {candidate.source}</p>
            {candidate.profile_url && (
              <a
                href={candidate.profile_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                View profile
              </a>
            )}
            {candidate.summary && <p>{candidate.summary}</p>}
          </CardContent>
        </Card>

        {jobId && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Match Score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm" data-testid="match-breakdown">
              {candidate.match ? (
                <>
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        "flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-xl font-semibold",
                        matchScoreTone(candidate.match.match_score) === "good" &&
                          "bg-emerald-100 text-emerald-700",
                        matchScoreTone(candidate.match.match_score) === "warning" &&
                          "bg-amber-100 text-amber-700",
                        matchScoreTone(candidate.match.match_score) === "critical" &&
                          "bg-red-100 text-red-700",
                      )}
                    >
                      {candidate.match.match_score}%
                    </span>
                    <div>
                      <p className="font-medium text-foreground">Overall Match</p>
                      <p className="text-muted-foreground">
                        How well this candidate fits the job&apos;s requirements.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      ["Skills", candidate.match.skills_score],
                      ["Experience", candidate.match.experience_score],
                      ["Location", candidate.match.location_score],
                      ["Education", candidate.match.education_score],
                      ["Seniority", candidate.match.seniority_score],
                    ].map(([label, score]) => (
                      <div key={label as string} className="rounded-lg border border-border p-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                        <p className="font-medium text-foreground">
                          {score !== null && score !== undefined ? `${score}%` : <EmptyCell />}
                        </p>
                      </div>
                    ))}
                  </div>
                  {candidate.match.ai_summary && <p>{candidate.match.ai_summary}</p>}

                  <div>
                    <p className="font-medium">Matched Requirements</p>
                    {candidate.match.matched_requirements.length > 0 ? (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {candidate.match.matched_requirements.map((req, i) => (
                          <li key={i}>{req}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">None listed.</p>
                    )}
                  </div>

                  <div>
                    <p className="font-medium">Missing Requirements</p>
                    {candidate.match.missing_requirements.length > 0 ? (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {candidate.match.missing_requirements.map((req, i) => (
                          <li key={i}>{req}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">None listed.</p>
                    )}
                  </div>

                  <div>
                    <p className="font-medium">Strengths</p>
                    {candidate.match.strengths.length > 0 ? (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {candidate.match.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">None listed.</p>
                    )}
                  </div>

                  <div>
                    <p className="font-medium">Concerns</p>
                    {candidate.match.concerns.length > 0 ? (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {candidate.match.concerns.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">None listed.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Not scored for this job yet.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Select
              value={candidate.status}
              onValueChange={handleStatusChange}
              disabled={isUpdatingStatus}
            >
              <SelectTrigger className="w-[200px]" data-testid="status-select">
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
            {statusError && (
              <p role="alert" className="text-sm text-destructive">
                {statusError}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Recruiter Notes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note about this candidate..."
                data-testid="note-input"
              />
              <Button
                type="button"
                onClick={handleAddNote}
                disabled={isSavingNote || !noteDraft.trim()}
                data-testid="note-add-button"
                className="self-start"
              >
                {isSavingNote ? "Saving..." : "Add Note"}
              </Button>
              {noteError && (
                <p role="alert" className="text-sm text-destructive">
                  {noteError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3" data-testid="notes-list">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="rounded-md border p-3 text-sm" data-testid="note-item">
                    <p>{note.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function CandidateProfileSkeleton() {
  return (
    <main className="min-h-screen">
      <DashboardNav />
      <p className="p-4 text-sm text-muted-foreground">Loading candidate...</p>
    </main>
  );
}

export default function CandidateProfilePage() {
  return (
    <Suspense fallback={<CandidateProfileSkeleton />}>
      <CandidateProfileContent />
    </Suspense>
  );
}
