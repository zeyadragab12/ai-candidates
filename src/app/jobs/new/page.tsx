"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Search,
  UploadCloud,
  Users,
  X,
  ArrowRight,
} from "lucide-react";

import { DashboardNav } from "@/components/dashboard/nav";
import { RequirementsEditor } from "@/components/jobs/RequirementsEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import type { JobAnalysis } from "@/types/job-analysis";
import { cn } from "@/lib/utils";

type InputMode = "paste" | "upload";

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "On-site"];

export default function NewJobPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accordion state
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(true);
  const [isJdOpen, setIsJdOpen] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [employmentType, setEmploymentType] = useState("");
  const [workArrangement, setWorkArrangement] = useState("");
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingCompanies(true);
    setCompaniesError(null);
    fetch("/api/companies", { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setCompaniesError(data.error ?? "Failed to load companies.");
          return;
        }
        setCompanies(data.companies ?? []);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCompaniesError("Failed to load companies.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingCompanies(false);
      });
    return () => controller.abort();
  }, []);

  const selectedCompanyName = companies.find((c) => c.id === companyId)?.name ?? null;

  // Job description & file upload state
  const [mode, setMode] = useState<InputMode>("upload");
  const [description, setDescription] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);

  // Automatic Sourcing state
  const [isSearching, setIsSearching] = useState(false);
  const [searchStep, setSearchStep] = useState<"idle" | "generating" | "sourcing" | "scoring">("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [searchRun, setSearchRun] = useState<{
    id: string;
    status: string;
    total_results: number | null;
    candidates_found: number | null;
    candidates_new: number | null;
    credits_used: number | null;
  } | null>(null);

  // Success Modal state
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [candidatesFoundCount, setCandidatesFoundCount] = useState(0);

  const jobDetailsErrors: Record<string, string> = {};
  if (!title.trim()) jobDetailsErrors.title = "Job title is required.";
  if (!companyId) jobDetailsErrors.company = "Company is required.";
  if (!employmentType) jobDetailsErrors.employmentType = "Employment type is required.";
  if (!workArrangement) jobDetailsErrors.workArrangement = "Work arrangement is required.";
  const isJobDetailsValid = Object.keys(jobDetailsErrors).length === 0;

  function markAllFieldsTouched() {
    setTouchedFields({
      title: true,
      company: true,
      employmentType: true,
      workArrangement: true,
    });
  }

  // File formatting helper
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  async function processFile(file: File) {
    setExtractError(null);
    setIsExtracting(true);
    setUploadedFileName(file.name);
    setUploadedFileSize(formatFileSize(file.size));
    toast.info(`Extracting text from ${file.name}...`, "Processing File");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/files/extract", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        const msg = data.error ?? "Failed to extract text from file.";
        setExtractError(msg);
        toast.error(msg);
        return;
      }

      setDescription(data.text);
      toast.success(`Extracted content from ${file.name}`, "Upload Successful");
    } catch {
      setExtractError("Failed to upload or process the file.");
      toast.error("Failed to upload or process the file.");
    } finally {
      setIsExtracting(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function handleRemoveFile() {
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setDescription("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleAnalyze() {
    if (description.trim().length < 50) return;

    // Requirement: Close accordions and show load screen
    setIsJobDetailsOpen(false);
    setIsJdOpen(false);
    setAnalyzeError(null);
    setIsAnalyzing(true);
    toast.info("Analyzing job description with AI...", "Processing JD");

    try {
      const response = await fetch("/api/jobs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescriptionText: description }),
      });
      const data = await response.json();

      if (!response.ok) {
        const msg = data.error ?? "Failed to analyze the job description.";
        setAnalyzeError(msg);
        toast.error(msg);
        return;
      }

      setAnalysis(data);
      if (!title && data.job_title) setTitle(data.job_title);
      if (!employmentType && data.employment_type) setEmploymentType(data.employment_type);
      toast.success("Requirements successfully extracted from job spec!", "Analysis Complete");
    } catch {
      setAnalyzeError("Failed to analyze the job description.");
      toast.error("Failed to analyze the job description.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function pollSearchRunStatus(runId: string, currentJobId: string) {
    // LinkedIn enrichment via Apify can take several minutes, so keep
    // polling well past that instead of giving up after a minute.
    const POLL_INTERVAL_MS = 2000;
    const MAX_WAIT_MS = 10 * 60 * 1000;
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      let res: Response;
      let run;
      try {
        res = await fetch(`/api/search/${runId}/status`);
        run = await res.json();
      } catch {
        // A single dropped poll (dev server recompiling, network blip)
        // shouldn't abort a search that's still running server-side.
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        continue;
      }

      if (!res.ok) {
        const msg = run.error ?? "Failed to check search status.";
        setSearchError(msg);
        toast.error(msg, "Search Error");
        return;
      }

      setSearchRun(run);

      if (run.status === "complete" || run.status === "error") {
        if (run.status === "error" && run.error) {
          setSearchError(run.error);
          toast.error(run.error, "Sourcing Failed");
        } else if (run.status === "complete") {
          const found = run.candidates_found ?? 0;
          setCandidatesFoundCount(found);
          setSavedJobId(currentJobId);
          setIsSuccessModalOpen(true);
          toast.success(`Found ${found} candidates! Sourcing complete.`, "Sourcing Succeeded");
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    setSearchError("Search is taking longer than expected. Check back shortly.");
    toast.warning("Search is taking longer than expected. Check back shortly.");
  }

  // Unified automatic flow: generates queries, saves job, searches candidates, and scores
  async function handleGenerateAndFindCandidates() {
    if (!analysis) return;
    if (isSearching) return; // guard against duplicate submissions

    if (!isJobDetailsValid) {
      markAllFieldsTouched();
      setIsJobDetailsOpen(true);
      const msg = "Please complete all required job details before continuing.";
      setSearchError(msg);
      toast.error(msg, "Missing Required Fields");
      return;
    }

    setSearchError(null);
    setIsSearching(true);
    setSearchStep("generating");
    setSearchRun(null);
    toast.info("Generating optimized search queries...", "Automated Sourcing");

    try {
      // 1. Generate optimized queries automatically
      const queryResponse = await fetch("/api/jobs/generate-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysis),
      });
      const queryData = await queryResponse.json();

      if (!queryResponse.ok) {
        const msg = queryData.error ?? "Failed to generate search queries.";
        setSearchError(msg);
        toast.error(msg);
        setIsSearching(false);
        return;
      }

      const generatedQueries = queryData.search_queries;

      // 2. Save job to Supabase
      setSearchStep("sourcing");
      toast.info("Saving role and scanning talent databases...", "Autonomous Search");

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || analysis.job_title,
          description,
          company_id: companyId,
          location: analysis.location,
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
        const msg = job.error ?? "Failed to save the job.";
        setSearchError(msg);
        toast.error(msg);
        setIsSearching(false);
        return;
      }

      setSavedJobId(job.id);

      // 3. Trigger candidate search run
      const searchResponse = await fetch(`/api/jobs/${job.id}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: generatedQueries }),
      });
      const run = await searchResponse.json();

      if (!searchResponse.ok) {
        const msg = run.error ?? "Failed to run candidate search.";
        setSearchError(msg);
        toast.error(msg);
        setIsSearching(false);
        return;
      }

      setSearchRun(run);
      setSearchStep("scoring");

      // 4. Poll status until complete
      await pollSearchRunStatus(run.id, job.id);
    } catch {
      setSearchError("An unexpected error occurred during candidate sourcing.");
      toast.error("An unexpected error occurred during candidate sourcing.");
    } finally {
      setIsSearching(false);
      setSearchStep("idle");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50/70 pb-24">
      <DashboardNav />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
            AI Talent Pipeline
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Create New Job Opening
          </h1>
          <p className="text-sm text-slate-500">
            Provide the role parameters and job description. Our AI will extract requirements, synthesize search queries, and source qualified candidates.
          </p>
        </div>

        {/* 1. Job Details Accordion */}
        <Card className="shadow-sm border-slate-200 transition-all">
          <CardHeader
            className="cursor-pointer select-none pb-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            onClick={() => setIsJobDetailsOpen((prev) => !prev)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-semibold text-sm">
                  1
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Job Details
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {isJobDetailsOpen
                      ? "Specify job title, company, and employment structure"
                      : `${title || "Role Title"} • ${selectedCompanyName || "Company"} • ${employmentType || "Full-time"} • ${workArrangement || "Remote"}`}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isJobDetailsOpen && (
                  <Badge tone="neutral" className="text-xs font-normal">
                    {title || "Configured"}
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                  {isJobDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>

          {isJobDetailsOpen && (
            <CardContent className="pt-6 flex flex-col gap-5 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="job-title" className="text-xs font-semibold text-slate-700">
                  Job Title <span className="text-red-600">*</span>
                </label>
                <Input
                  id="job-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTouchedFields((prev) => ({ ...prev, title: true }))}
                  placeholder="e.g. Senior React Developer"
                  className="bg-white"
                  aria-invalid={touchedFields.title && !!jobDetailsErrors.title}
                  data-testid="job-title-input"
                />
                {touchedFields.title && jobDetailsErrors.title && (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {jobDetailsErrors.title}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="job-company" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  Company <span className="text-red-600">*</span>
                </label>
                <Select
                  value={companyId}
                  onValueChange={(value) => {
                    setCompanyId(value);
                    setTouchedFields((prev) => ({ ...prev, company: true }));
                  }}
                  disabled={isLoadingCompanies}
                >
                  <SelectTrigger
                    id="job-company"
                    className="bg-white"
                    aria-invalid={touchedFields.company && !!jobDetailsErrors.company}
                    data-testid="job-company-trigger"
                  >
                    <SelectValue
                      placeholder={isLoadingCompanies ? "Loading companies..." : "Select a company"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touchedFields.company && jobDetailsErrors.company && (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {jobDetailsErrors.company}
                  </p>
                )}
                {companiesError && (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {companiesError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    Employment Type <span className="text-red-600">*</span>
                  </span>
                  <Select
                    value={employmentType}
                    onValueChange={(value) => {
                      setEmploymentType(value);
                      setTouchedFields((prev) => ({ ...prev, employmentType: true }));
                    }}
                  >
                    <SelectTrigger className="bg-white" data-testid="job-employment-type-trigger">
                      <SelectValue placeholder="Select type (e.g. Full-time)" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {touchedFields.employmentType && jobDetailsErrors.employmentType && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {jobDetailsErrors.employmentType}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    Work Arrangement <span className="text-red-600">*</span>
                  </span>
                  <Select
                    value={workArrangement}
                    onValueChange={(value) => {
                      setWorkArrangement(value);
                      setTouchedFields((prev) => ({ ...prev, workArrangement: true }));
                    }}
                  >
                    <SelectTrigger className="bg-white" data-testid="job-work-arrangement-trigger">
                      <SelectValue placeholder="Select arrangement (e.g. Remote)" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_ARRANGEMENTS.map((arrangement) => (
                        <SelectItem key={arrangement} value={arrangement}>
                          {arrangement}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {touchedFields.workArrangement && jobDetailsErrors.workArrangement && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {jobDetailsErrors.workArrangement}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsJobDetailsOpen(false)}
                  className="text-xs text-slate-600"
                >
                  Save & Collapse
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 2. Job Description Accordion */}
        <Card className="shadow-sm border-slate-200 transition-all">
          <CardHeader
            className="cursor-pointer select-none pb-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            onClick={() => setIsJdOpen((prev) => !prev)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-semibold text-sm">
                  2
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Job Description
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {isJdOpen
                      ? "Upload a document or paste the raw job description"
                      : uploadedFileName
                        ? `File: ${uploadedFileName} (${uploadedFileSize})`
                        : description
                          ? `${description.slice(0, 60)}...`
                          : "Empty job description"}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isJdOpen && description && (
                  <Badge tone="good" className="text-xs font-normal">
                    {uploadedFileName ? "File Attached" : `${description.length} chars`}
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                  {isJdOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>

          {isJdOpen && (
            <CardContent className="pt-6 flex flex-col gap-5 animate-in fade-in duration-200">
              
              {/* Mode Toggle */}
              <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setMode("upload")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    mode === "upload"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  Upload File (PDF / DOCX)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    mode === "paste"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Paste Text
                </button>
              </div>

              {/* Upload Mode: Redesigned Drag & Drop Area */}
              {mode === "upload" ? (
                <div className="flex flex-col gap-3">
                  <input
                    ref={fileInputRef}
                    data-testid="jd-file-input"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {!uploadedFileName ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center",
                        isDragging
                          ? "border-indigo-500 bg-indigo-50/50"
                          : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/80"
                      )}
                    >
                      <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        Click to upload or drag & drop file
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supports PDF, DOCX, or TXT documents up to 10MB
                      </p>
                      <div className="flex items-center gap-2 mt-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">PDF</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">DOCX</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">TXT</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-indigo-100 bg-indigo-50/40">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                            DOC
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{uploadedFileName}</p>
                            <p className="text-xs text-slate-500">{uploadedFileSize} • Ready for analysis</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs h-8 bg-white"
                          >
                            Change File
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleRemoveFile}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {description && (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 max-h-40 overflow-y-auto leading-relaxed">
                          <span className="font-semibold text-slate-900 block mb-1">Extracted Text Preview:</span>
                          {description}
                        </div>
                      )}
                    </div>
                  )}

                  {isExtracting && (
                    <div className="flex items-center gap-2 text-xs font-medium text-indigo-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Parsing text from {uploadedFileName}...
                    </div>
                  )}

                  {extractError && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {extractError}
                    </p>
                  )}
                </div>
              ) : (
                /* Paste Text Mode */
                <div className="flex flex-col gap-2">
                  <Textarea
                    data-testid="jd-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Paste the full job description here (responsibilities, technical requirements, qualifications)..."
                    rows={10}
                    className="bg-white text-sm leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Minimum 50 characters required</span>
                    <span>{description.length} characters</span>
                  </div>
                </div>
              )}

              {/* Action: Analyze Job Button */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || description.trim().length < 50}
                  className="w-full sm:w-auto self-end bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  Analyze Job with AI
                </Button>
                {analyzeError && (
                  <p role="alert" className="text-xs font-medium text-red-600 text-right">
                    {analyzeError}
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* 3. Loading Screen when Analyzing */}
        {isAnalyzing && (
          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-indigo-50/30 p-8 text-center shadow-lg animate-in fade-in duration-300">
            <div className="flex flex-col items-center justify-center max-w-md mx-auto">
              <div className="relative mb-5">
                <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 animate-pulse">
                  <FileText className="h-8 w-8" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900">
                Analyzing Job Description...
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Our AI model is extracting required technical skills, preferred competencies, seniority level, and candidate qualifications.
              </p>
              <div className="w-full bg-indigo-100 rounded-full h-1.5 mt-6 overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full animate-indeterminate" />
              </div>
            </div>
          </Card>
        )}

        {/* 4. Extracted Requirements Section (Redesigned & Pleasant) */}
        {analysis && (
          <Card className="shadow-sm border-slate-200 animate-in fade-in duration-300">
            <CardHeader className="pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl font-bold text-slate-900">
                    Extracted Requirements
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Review and fine-tune extracted parameters before autonomous candidate discovery
                  </CardDescription>
                </div>
                <Badge tone="good" className="text-xs font-medium">
                  Analysis Verified
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <RequirementsEditor value={analysis} onChange={setAnalysis} />

              {/* 5. Automated Sourcing Trigger (No Search Query Form shown!) */}
              <div className="mt-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Search className="h-4 w-4 text-indigo-400" />
                      Ready to Find Candidates?
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                      Click below to automatically synthesize targeted queries, search authorized web sources, deduplicate records, and score candidate profiles against your criteria.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleGenerateAndFindCandidates}
                    disabled={isSearching || !isJobDetailsValid}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 shrink-0 disabled:opacity-60"
                    data-testid="find-candidates-button"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Finding Candidates...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Generate Queries & Find Candidates
                      </>
                    )}
                  </Button>
                </div>

                {!isJobDetailsValid && (
                  <p className="mt-3 text-xs text-amber-300">
                    Complete all required job details (title, company, employment type, work
                    arrangement) above to continue.
                  </p>
                )}

                {/* Sourcing in progress live banner */}
                {isSearching && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 text-xs text-indigo-200">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    <span>
                      {searchStep === "generating" && "Synthesizing multi-variable search queries..."}
                      {searchStep === "sourcing" && "Querying authorized talent pools across public sources..."}
                      {searchStep === "scoring" && "Deduplicating candidates and computing AI match scores..."}
                    </span>
                  </div>
                )}

                {searchError && (
                  <div className="mt-3 rounded-lg bg-red-500/20 p-3 border border-red-500/30 text-xs text-red-200">
                    {searchError}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* 6. Success Alert in Middle of Screen Modal */}
      {isSuccessModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 text-center shadow-2xl ring-1 ring-slate-900/10 animate-in zoom-in-95 duration-200">
            
            {/* Success Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-5 ring-8 ring-emerald-50">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h2 className="font-display text-2xl font-bold text-slate-900">
              Candidate Sourcing Complete!
            </h2>

            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Successfully identified and evaluated{" "}
              <span className="font-bold text-slate-900 text-base">
                {candidatesFoundCount} candidates
              </span>{" "}
              matching your requirements for{" "}
              <span className="font-medium text-slate-900">
                {title || analysis?.job_title || "this role"}
              </span>.
            </p>

            {selectedCompanyName && (
              <p className="text-xs text-slate-400 mt-1">
                Company: <span className="font-medium text-slate-600">{selectedCompanyName}</span>
              </p>
            )}

            {/* Two Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSuccessModalOpen(false)}
                className="w-full sm:w-1/2 text-slate-700 hover:bg-slate-50"
              >
                Close
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  if (savedJobId) {
                    router.push(`/candidates?jobId=${savedJobId}`);
                  } else {
                    router.push("/candidates");
                  }
                }}
                className="w-full sm:w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-600/20"
              >
                Show Candidates
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
