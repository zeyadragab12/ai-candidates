# SPEC — AI Candidate Sourcing & Recruitment Research Platform

## Overview

I want you to build a full-stack web application for recruiters and HR teams.

The main idea:

1. The user uploads or pastes a Job Description.
2. The system analyzes the Job Description using AI.
3. AI extracts the job title, required skills, experience, location, education, keywords, and other requirements.
4. The system generates optimized search queries from the extracted requirements.
5. The backend searches candidate data through LEGAL and AUTHORIZED search/data providers.
6. The system collects publicly available candidate information returned by those providers.
7. The system normalizes the candidate data.
8. AI evaluates how well each candidate matches the Job Description.
9. The system calculates a transparent matching score.
10. The candidates appear in a dashboard.
11. The recruiter can filter, sort, search, and review candidates.
12. The recruiter can export the candidate results to Excel.
13. The architecture must allow us to replace the search/data provider later without rewriting the application.

**IMPORTANT LEGAL REQUIREMENT:**

Do NOT scrape LinkedIn, Indeed, or other websites in violation of their Terms of Service.
Do NOT bypass CAPTCHAs, authentication, rate limits, robots.txt restrictions, paywalls, or other technical protections.
Use official APIs, licensed data providers, public search APIs, or other authorized sources.
The application should have a provider abstraction layer so different providers can be connected later.

---

## Tech Stack

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query, Lucide React

**Backend:** Next.js API Routes / Route Handlers, TypeScript, server-side API integrations, Zod validation

**Database:** Supabase, PostgreSQL, Supabase Auth, Supabase Storage if file storage is required

**AI:** Use an AI provider abstraction. Primary option: Google Gemini API. The code must make the AI provider replaceable later.

AI responsibilities: Job Description analysis, search query generation, candidate profile normalization, candidate-to-job matching, candidate summary generation.

**Search:** Create a `SearchProvider` interface:

```ts
interface SearchProvider {
  searchCandidates(params: CandidateSearchParams): Promise<CandidateSearchResult[]>;
}
```

The first provider should use an authorized search/data API. Possible providers: Google Programmable Search / Custom Search, SerpAPI, Serper, Bing or another authorized search provider, licensed recruitment/candidate data APIs. Do not hard-code the application around one provider.

**Excel:** Use SheetJS / xlsx. The system must generate an `.xlsx` file.

**File upload:** Support PDF, DOCX, TXT, direct text input. Use appropriate server-side libraries to extract text from uploaded files.

---

## Application Structure

Pages: `/login`, `/dashboard`, `/jobs`, `/jobs/new`, `/jobs/[id]`, `/candidates`, `/candidates/[id]`, `/settings`

---

## Authentication

Use Supabase Auth. Support email/password authentication, logout, protected dashboard routes. Only authenticated users should access jobs and candidate information. Use Row Level Security in Supabase. Users should only access their own jobs and candidates unless team accounts are introduced later.

---

## Job Creation

Create a "New Job" page with two input options: paste JD, or upload JD (PDF, DOCX, TXT).

UI fields: Job Title, Job Description, Location, Employment Type, Remote/Hybrid/On-site.

Button: "Analyze Job". On click:
1. Validate the input.
2. Extract text from the uploaded file if required.
3. Send the Job Description to the AI service.
4. Return structured JSON.
5. Display the extracted requirements.
6. Allow the recruiter to edit the extracted information.
7. Save the job to Supabase.

---

## AI Job Analysis

The AI must return structured JSON:

```json
{
  "job_title": "",
  "seniority": "",
  "location": "",
  "employment_type": "",
  "required_skills": [],
  "preferred_skills": [],
  "years_of_experience": { "minimum": null, "maximum": null },
  "education": [],
  "certifications": [],
  "languages": [],
  "industries": [],
  "keywords": [],
  "responsibilities": [],
  "search_keywords": [],
  "search_queries": []
}
```

Use Zod to validate the AI response. Never trust raw AI output without validation.

---

## Search Query Generation

After analyzing the Job Description, generate multiple search query variations. Example — job "Frontend React Developer with 3+ years experience" might generate:

- `React Developer 3 years TypeScript Next.js`
- `Frontend Developer React TypeScript Egypt`
- `React Developer Next.js JavaScript Cairo`

Each query should contain: job title, important skills, seniority, location, relevant keywords. Avoid unnecessarily long queries. Allow the recruiter to see and edit the generated search queries before starting the search. Button: "Find Candidates".

---

## Search Provider Architecture

Create `/lib/search/`: `SearchProvider.ts`, `SerpApiProvider.ts`, `SerperProvider.ts`, `MockSearchProvider.ts`.

```ts
export interface SearchProvider {
  searchCandidates(params: CandidateSearchParams): Promise<CandidateSearchResult[]>;
}

interface CandidateSearchParams {
  query: string;
  location?: string;
  page?: number;
  limit?: number;
}

interface CandidateSearchResult {
  source: string;
  source_url: string;
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  profile_url?: string;
  snippet?: string;
  skills?: string[];
}
```

The application must support MOCK DATA — when API keys are not available, the developer should still be able to run the application locally using `MockSearchProvider`.

Provider selector via environment variable:
```
SEARCH_PROVIDER=mock
SEARCH_PROVIDER=serpapi
SEARCH_PROVIDER=serper
```

---

## Candidate Normalization

Search providers return different structures — create a normalization layer.

Output (Normalized Candidate):
```json
{
  "name": "John Smith",
  "headline": "Senior React Developer",
  "current_company": "ABC Company",
  "location": "Cairo, Egypt",
  "profile_url": "https://...",
  "source": "provider_name",
  "source_url": "https://...",
  "summary": "...",
  "skills": ["React", "TypeScript", "Next.js"],
  "experience_years": 4
}
```

Do not assume information exists. If a field is missing, use `null` or an empty array. **Never invent candidate information.**

---

## Duplicate Detection

The same candidate could appear in multiple search queries. Detect duplicates using: (1) profile URL when available, (2) normalized name + company, (3) other safe identifiers when available. Do not create duplicate candidate records.

---

## AI Candidate Matching

Compare every candidate against the Job Description, analyzing: required skills, preferred skills, experience, seniority, location, education, certifications, industry experience, job responsibilities, other relevant requirements.

Return structured JSON:
```json
{
  "match_score": 87,
  "skills_score": 92,
  "experience_score": 85,
  "location_score": 100,
  "education_score": 80,
  "seniority_score": 90,
  "matched_requirements": [],
  "missing_requirements": [],
  "strengths": [],
  "concerns": [],
  "summary": ""
}
```

The score must come from explicit criteria — do not make arbitrary judgments. Display the factors behind the score (e.g. Overall Match: 87% / Skills: 92% / Experience: 85% / Location: 100% / Seniority: 90% / Education: 80%).

---

## Candidate Dashboard

Display: Candidate Name, Job Title, Company, Location, Experience, Skills, Match Score, Source, Profile Link, Status.

Statuses: New, Reviewed, Shortlisted, Rejected, Contacted. Allow recruiters to change candidate status.

---

## Filters

Search by candidate name, search by skill. Filter by: match score, location, experience, seniority, skills, company, status, source. Sort by: match score high→low, match score low→high, experience, name, date added. Add pagination.

---

## Candidate Profile Page (`/candidates/[id]`)

Show: Name, Headline, Company, Location, Profile URL, Source, Skills, Experience, AI Summary, Match Score, Detailed Matching Breakdown, Matched Requirements, Missing Requirements, Strengths, Concerns, Recruiter Notes, Candidate Status.

---

## Excel Export

"Export Excel" button. Exported file columns: Name, Headline, Company, Location, Experience, Skills, Match Score, Skills Score, Experience Score, Location Score, Seniority Score, Matched Requirements, Missing Requirements, AI Summary, Source, Profile URL, Status, Recruiter Notes, Date Added.

Use SheetJS/xlsx. Filename example: `candidates-react-developer-2026-09-17.xlsx`. Make the file clean and readable — set column widths, add headers, do not include unnecessary technical database fields.

---

## Database (Supabase PostgreSQL)

Tables: `users`, `jobs`, `candidates`, `candidate_matches`, `search_queries`, `search_runs`, `candidate_notes`, `candidate_status_history`.

**jobs:** id, user_id, title, description, location, employment_type, seniority, required_skills, preferred_skills, minimum_experience, maximum_experience, education, certifications, languages, keywords, ai_analysis, created_at, updated_at

**candidates:** id, user_id, name, headline, company, location, profile_url, source, source_url, summary, skills, experience_years, raw_data, created_at, updated_at

**candidate_matches:** id, job_id, candidate_id, match_score, skills_score, experience_score, location_score, education_score, seniority_score, matched_requirements, missing_requirements, strengths, concerns, ai_summary, created_at

**search_queries:** id, job_id, query, provider, created_at

**search_runs:** id, job_id, provider, status, total_results, started_at, completed_at, error

**candidate_notes:** id, candidate_id, user_id, note, created_at, updated_at

**candidate_status_history:** id, candidate_id, user_id, old_status, new_status, created_at

Use JSONB fields for flexible AI analysis data. Add proper indexes, foreign keys, and Row Level Security.

---

## Search Process (Full Workflow)

1. User creates a job.
2. User uploads or pastes Job Description.
3. Backend extracts text.
4. AI analyzes Job Description.
5. Show extracted requirements.
6. User reviews and edits requirements.
7. AI generates search queries.
8. User reviews search queries.
9. User clicks "Find Candidates".
10. Backend starts a search run.
11. Backend sends queries to the selected search provider.
12. Collect results.
13. Normalize candidate data.
14. Remove duplicates.
15. Save candidates to Supabase.
16. Run candidate matching.
17. Save match results.
18. Display candidates.
19. Recruiter filters and reviews candidates.
20. Recruiter exports results to Excel.

---

## Background Jobs

The search process could return many candidates — do not block the frontend while processing hundreds of them. Design the architecture so long-running searches can use background jobs. For the MVP, create a clean service architecture supporting queue, background worker, retry, progress tracking. Possible future technologies: Inngest, Trigger.dev, Upstash QStash, BullMQ + Redis. Keep the first version simple.

---

## API Structure

```
POST   /api/jobs/analyze
POST   /api/jobs
GET    /api/jobs
GET    /api/jobs/:id
PUT    /api/jobs/:id
DELETE /api/jobs/:id
POST   /api/jobs/:id/search
GET    /api/jobs/:id/candidates
GET    /api/candidates/:id
PUT    /api/candidates/:id/status
POST   /api/candidates/:id/notes
POST   /api/candidates/match
GET    /api/jobs/:id/export
GET    /api/search/:runId/status
```

---

## Security

Never expose API keys to the frontend. Store API keys in environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
SERPAPI_API_KEY=
SERPER_API_KEY=
SEARCH_PROVIDER=mock
```

Never commit `.env` files — create `.env.example`. Validate environment variables at startup. Use server-side API calls for AI and search providers. Validate all user input using Zod. Protect API routes with authentication. Use Supabase Row Level Security.

---

## Error Handling

Handle: invalid Job Description, unsupported file, large file, AI API error, search provider error, rate limit, timeout, duplicate candidate, invalid AI JSON, database error, Excel export error. Display friendly messages to the recruiter. Never expose API keys or internal errors.

---

## Rate Limiting

Design rate limiting for: AI requests, search requests, job analysis, candidate matching, Excel export. Use a provider such as Upstash Redis later if required. For MVP, create a simple service layer so rate limiting can be added without changing business logic.

---

## UI / UX

Professional SaaS-style interface. Use Tailwind CSS, shadcn/ui, responsive design, clean dashboard, cards, tables, tabs, dialogs, dropdowns, toast notifications, loading states, skeleton loaders, empty states, error states.

Main dashboard shows: Total Jobs, Total Candidates, Shortlisted Candidates, Average Match Score, Recent Jobs, Recent Search Runs.

---

## AI Prompt Architecture

Do not put large AI prompts directly inside React components. Create `/lib/ai/`: `AIProvider.ts`, `GeminiProvider.ts`, `prompts/job-analysis.ts`, `prompts/search-query-generation.ts`, `prompts/candidate-normalization.ts`, `prompts/candidate-matching.ts`. Use structured output wherever supported. Create TypeScript types and Zod schemas for every AI response.

---

## Project Architecture

```
src/
  app/
    login/
    dashboard/
    jobs/
    candidates/
    settings/
    api/
  components/
    ui/
    jobs/
    candidates/
    dashboard/
  lib/
    ai/
    search/
    database/
    export/
    files/
    validation/
    utils/
  types/
supabase/
  migrations/
services/
  jobs/
  candidates/
  search/
  matching/
  export/
```

---

## Development Rules

1. Use TypeScript, strict typing. Avoid `any` unless necessary.
2. Separate UI logic from business logic.
3. Separate external providers from internal business logic.
4. Create reusable components and services.
5. Do not hard-code API keys or search providers.
6. Do not scrape websites illegally.
7. Do not invent candidate information.
8. Do not generate fake candidate data in production. `MockSearchProvider` is for local development only.
9. Validate AI responses with Zod.
10. Handle API failures gracefully.
11. Add loading, error, and empty states.
12. Add pagination and duplicate detection.
13. Add database indexes.
14. Use Supabase RLS.
15. Keep the code easy to extend.

---

## MVP Development Plan (Phases)

**Phase 1:** Project setup — Next.js, TypeScript, Tailwind, shadcn/ui, Supabase, authentication, environment configuration, basic dashboard.

**Phase 2:** Job creation — Job Description upload, PDF/DOCX/TXT extraction, AI Job Description analysis, structured requirements, Supabase storage.

**Phase 3:** Search architecture — `SearchProvider` interface, `MockSearchProvider`, one real authorized search provider, search query generation, search results.

**Phase 4:** Candidate system — normalization, duplicate detection, database storage, candidate dashboard, candidate profile, filters, sorting, pagination.

**Phase 5:** AI Matching — candidate-to-job matching, match score, detailed score breakdown, matched/missing requirements, AI summary.

**Phase 6:** Excel — export, formatted spreadsheet, filtering before export.

**Phase 7:** Production improvements — error handling, rate limiting, background jobs, retry system, logging, security, performance, analytics.

---

## First Task Instructions

Do NOT try to build the entire application in one huge response. Start with Phase 1 only:

1. Create the Next.js project structure.
2. Configure TypeScript.
3. Configure Tailwind.
4. Configure shadcn/ui.
5. Configure Supabase.
6. Create Supabase client utilities.
7. Create authentication.
8. Create protected dashboard routes.
9. Create the basic dashboard UI.
10. Create `.env.example`.
11. Create the initial database migration.
12. Create clean folder structure.
13. Explain every important file created.
14. Run the project and fix errors.

After Phase 1 works, stop and show what was completed. Wait for instruction before moving to Phase 2. Do not skip phases. Do not create fake integrations. Do not pretend an API exists if it's unavailable. When a third-party API requires a paid plan or API key, clearly isolate the integration and provide a `MockSearchProvider` for development. The final application should be production-ready in architecture, while the MVP stays simple enough for one developer to build and maintain.
