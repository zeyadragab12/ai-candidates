"use client";

import { useRef, useState } from "react";

import { DashboardNav } from "@/components/dashboard/nav";
import { RequirementsEditor } from "@/components/jobs/RequirementsEditor";
import { SearchQueries } from "@/components/jobs/SearchQueries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JobAnalysis } from "@/types/job-analysis";

type InputMode = "paste" | "upload";

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "On-site"];

export default function NewJobPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<InputMode>("paste");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [workArrangement, setWorkArrangement] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    null,
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [isGeneratingQueries, setIsGeneratingQueries] = useState(false);
  const [generateQueriesError, setGenerateQueriesError] = useState<
    string | null
  >(null);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRun, setSearchRun] = useState<{
    id: string;
    status: string;
    total_results: number | null;
    candidates_found: number | null;
    candidates_new: number | null;
    credits_used: number | null;
  } | null>(null);

  async function pollSearchRunStatus(runId: string) {
    const POLL_INTERVAL_MS = 1500;
    const MAX_ATTEMPTS = 40; // ~60s ceiling so a stuck run doesn't poll forever

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`/api/search/${runId}/status`);
      const run = await res.json();

      if (!res.ok) {
        setSearchError(run.error ?? "Failed to check search status.");
        return;
      }

      setSearchRun(run);

      if (run.status === "complete" || run.status === "error") {
        if (run.status === "error" && run.error) {
          setSearchError(run.error);
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    setSearchError("Search is taking longer than expected. Check back shortly.");
  }

  async function handleFindCandidates() {
    if (!analysis) return;

    setSearchError(null);
    setIsSearching(true);
    setSearchRun(null);

    try {
      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || analysis.job_title,
          description,
          location: location || analysis.location,
          employment_type: employmentType || analysis.employment_type,
          work_arrangement: workArrangement,
          seniority: analysis.seniority,
          required_skills: analysis.required_skills,
          preferred_skills: analysis.preferred_skills,
          minimum_experience: analysis.years_of_experience.minimum,
          maximum_experience: analysis.years_of_experience.maximum,
          education: analysis.education,
          certifications: analysis.certifications,
          languages: analysis.languages,
          keywords: analysis.keywords,
          ai_analysis: analysis,
        }),
      });
      const job = await jobResponse.json();

      if (!jobResponse.ok) {
        setSearchError(job.error ?? "Failed to save the job.");
        return;
      }

      const searchResponse = await fetch(`/api/jobs/${job.id}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: searchQueries }),
      });
      const run = await searchResponse.json();

      if (!searchResponse.ok) {
        setSearchError(run.error ?? "Failed to run the candidate search.");
        return;
      }

      setSearchRun(run);
      await pollSearchRunStatus(run.id);
    } catch {
      setSearchError("Failed to run the candidate search.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleGenerateQueries() {
    if (!analysis) return;

    setGenerateQueriesError(null);
    setIsGeneratingQueries(true);

    try {
      const response = await fetch("/api/jobs/generate-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysis),
      });
      const data = await response.json();

      if (!response.ok) {
        setGenerateQueriesError(
          data.error ?? "Failed to generate search queries.",
        );
        return;
      }

      setSearchQueries(data.search_queries);
    } catch {
      setGenerateQueriesError("Failed to generate search queries.");
    } finally {
      setIsGeneratingQueries(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzeError(null);
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/jobs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescriptionText: description }),
      });
      const data = await response.json();

      if (!response.ok) {
        setAnalyzeError(data.error ?? "Failed to analyze the job description.");
        return;
      }

      setAnalysis(data);
    } catch {
      setAnalyzeError("Failed to analyze the job description.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setExtractError(null);
    setIsExtracting(true);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/files/extract", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setExtractError(data.error ?? "Failed to extract text from file.");
        return;
      }

      setDescription(data.text);
    } catch {
      setExtractError("Failed to upload or process the file.");
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <main className="min-h-screen">
      <DashboardNav />
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 sm:py-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            New Job
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste or upload a job description — we&apos;ll extract requirements and
            build a sourcing search for you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="job-title" className="text-sm font-medium">
                Job Title
              </label>
              <Input
                id="job-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior React Developer"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="job-location" className="text-sm font-medium">
                  Location
                </label>
                <Input
                  id="job-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Cairo, Egypt"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Employment Type</span>
                <Select value={employmentType} onValueChange={setEmploymentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Work Arrangement</span>
                <Select
                  value={workArrangement}
                  onValueChange={setWorkArrangement}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select arrangement" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_ARRANGEMENTS.map((arrangement) => (
                      <SelectItem key={arrangement} value={arrangement}>
                        {arrangement}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Job Description</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "paste" ? "default" : "outline"}
                onClick={() => setMode("paste")}
              >
                Paste text
              </Button>
              <Button
                type="button"
                variant={mode === "upload" ? "default" : "outline"}
                onClick={() => setMode("upload")}
              >
                Upload file
              </Button>
            </div>

            {mode === "paste" ? (
              <Textarea
                data-testid="jd-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste the job description here..."
                rows={12}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <input
                  ref={fileInputRef}
                  data-testid="jd-file-input"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="text-sm"
                />
                {isExtracting && (
                  <p className="text-sm text-muted-foreground">
                    Extracting text from {uploadedFileName}...
                  </p>
                )}
                {extractError && (
                  <p role="alert" className="text-sm text-destructive">
                    {extractError}
                  </p>
                )}
                {!isExtracting && description && !extractError && (
                  <div
                    data-testid="jd-preview"
                    className="max-h-64 overflow-y-auto rounded-md border p-3 text-sm text-muted-foreground"
                  >
                    {description}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || description.trim().length < 50}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Job"}
          </Button>
          {analyzeError && (
            <p role="alert" className="text-sm text-destructive">
              {analyzeError}
            </p>
          )}
        </div>

        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Extracted Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <RequirementsEditor value={analysis} onChange={setAnalysis} />
            </CardContent>
          </Card>
        )}

        {analysis && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateQueries}
              disabled={isGeneratingQueries}
            >
              {isGeneratingQueries
                ? "Generating..."
                : "Generate Search Queries"}
            </Button>
            {generateQueriesError && (
              <p role="alert" className="text-sm text-destructive">
                {generateQueriesError}
              </p>
            )}
          </div>
        )}

        {searchQueries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Search Queries</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SearchQueries
                queries={searchQueries}
                onChange={setSearchQueries}
              />
              <Button
                type="button"
                onClick={handleFindCandidates}
                disabled={isSearching}
              >
                {isSearching ? "Searching..." : "Find Candidates"}
              </Button>
              {searchError && (
                <p role="alert" className="text-sm text-destructive">
                  {searchError}
                </p>
              )}
              {searchRun && (
                <div
                  data-testid="search-run-result"
                  className="rounded-md border p-3 text-sm"
                >
                  <p data-testid="search-run-status">Status: {searchRun.status}</p>
                  {searchRun.status === "complete" && (
                    <>
                      <p>Candidates found: {searchRun.candidates_found ?? searchRun.total_results}</p>
                      <p>New candidates: {searchRun.candidates_new ?? "—"}</p>
                      <p>Credits used: {searchRun.credits_used ?? 0}</p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
