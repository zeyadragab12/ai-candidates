# User Stories: AI-Candidate Platform

## Overview
This document outlines the user personas, core epics, and detailed user stories with acceptance criteria and real-time alert feedback for the **AI Candidate Sourcing & Recruitment Research Platform**.

---

## 1. User Personas

### Primary Persona: Sarah (Senior Technical Recruiter)
- **Role**: Talent Acquisition Lead for Engineering & Product teams.
- **Pain Points**:
  - Spending 15+ hours per week manually searching job boards and reading irrelevant profiles.
  - Inconsistent evaluation of candidates against complex technical requirements.
  - Manually copying candidate details into spreadsheets to share with hiring managers.
- **Goals**:
  - Automatically extract core requirements from technical job descriptions.
  - Source high-potential candidates across authorized sources rapidly.
  - Receive clear, defensible AI match scores and export clean spreadsheets for hiring managers.

### Secondary Persona: Alex (Engineering Hiring Manager)
- **Role**: VP of Engineering.
- **Pain Points**:
  - Receives lists of candidates that don't match the actual seniority or tech stack required.
  - Lacks transparency into why candidates were shortlisted.
- **Goals**:
  - Review candidates with a structured scoring breakdown (Skills, Experience, Seniority, Location).

---

## 2. Epics & User Stories

### Epic 1: Intelligent Job Specification & AI Ingestion

#### Story 1.1: Upload or Paste Job Description
> **As Sarah (Recruiter)**,
> **I want to** paste or upload a job description in PDF, DOCX, or plain text format,
> **So that** I don't have to manually re-type role details.

- **Acceptance Criteria**:
  - System supports drag-and-drop or file selection for PDF, DOCX, and TXT files.
  - Direct paste text area is available with auto-resizing.
  - Corrupt or unsupported files display a friendly error message.
- **Alert / Feedback**:
  - **Success Toast**: `Extracted job spec from [filename]` upon successful text parsing.
  - **Error Toast**: Clear notification if the file format is invalid or extraction fails.

#### Story 1.2: AI Job Analysis & Requirement Customization
> **As Sarah (Recruiter)**,
> **I want** the AI to analyze the job description into structured requirements and allow me to edit them,
> **So that** I can tailor the exact search parameters before sourcing.

- **Acceptance Criteria**:
  - AI extracts: Job Title, Seniority, Location, Employment Type, Required Skills, Preferred Skills, Years of Experience, Education, and Keywords.
  - Output is strictly validated by Zod.
  - Recruiter can add, delete, or modify any skill or requirement badge.
- **Alert / Feedback**:
  - **Progress Toast**: `Analyzing job description with AI...`
  - **Success Toast**: `Requirements successfully extracted from job spec!`

---

### Epic 2: Autonomous Sourcing & Search Query Generation

#### Story 2.1: Automated Query Optimization
> **As Sarah (Recruiter)**,
> **I want** the system to generate multiple targeted search queries from the extracted job requirements,
> **So that** I reach a diverse and relevant candidate pool.

- **Acceptance Criteria**:
  - System generates 2–4 concise queries combining title, top skills, seniority, and location.
  - Recruiter can edit, add, or delete any generated query.
- **Alert / Feedback**:
  - **Success Toast**: `[X] search queries generated!`

#### Story 2.2: Authorized Search Run Execution
> **As Sarah (Recruiter)**,
> **I want to** execute the search run using authorized search providers without waiting on a frozen screen,
> **So that** candidates are gathered in the background while I continue my work.

- **Acceptance Criteria**:
  - Search runs query public, authorized APIs (or deterministic mock data in dev mode).
  - Candidates are deterministically normalized and deduplicated without inventing information.
  - Progress can be polled via status endpoints (`pending` -> `running` -> `complete`).
- **Alert / Feedback**:
  - **Start Toast**: `Saving job and launching candidate search...`
  - **Complete Toast**: `Found [X] candidates! AI scoring completed.`
  - **Error Toast**: Friendly notification if provider limits or network errors occur.

---

### Epic 3: Transparent AI Candidate Matching & Evaluation

#### Story 3.1: Defensible Match Scoring Breakdown
> **As Alex (Hiring Manager) and Sarah (Recruiter)**,
> **I want** each candidate to receive a transparent match score (0–100%) with categorized criteria,
> **So that** we understand exactly why a candidate was recommended.

- **Acceptance Criteria**:
  - Scores broken down into: Overall Match, Skills Score, Experience Score, Location Score, Education Score, Seniority Score.
  - Clear lists of Matched Requirements, Missing Requirements, Strengths, and Concerns.
  - Color-coded badges indicating match strength (Green >= 70%, Amber 40–69%, Red < 40%).

---

### Epic 4: Candidate Pipeline Management & Excel Export

#### Story 4.1: Candidate Dashboard & Status Updates
> **As Sarah (Recruiter)**,
> **I want to** filter candidates by score, location, skills, and change candidate statuses,
> **So that** I can manage my recruitment pipeline efficiently.

- **Acceptance Criteria**:
  - Multi-select and text filters for skills, location, company, experience, and score range.
  - Statuses include: `New`, `Reviewed`, `Shortlisted`, `Rejected`, `Contacted`.
  - Recruiter can add timestamped notes to candidates.
- **Alert / Feedback**:
  - **Status Change Toast**: `Candidate status updated to "[Status]"`
  - **Note Saved Toast**: `Recruiter note saved to candidate record`

#### Story 4.2: One-Click Excel Export
> **As Sarah (Recruiter)**,
> **I want to** export my filtered candidate list to Excel with one click,
> **So that** I can send formatted candidate profiles to hiring managers.

- **Acceptance Criteria**:
  - Exports an `.xlsx` file generated via SheetJS.
  - Columns include: Name, Headline, Company, Location, Experience, Skills, Match Scores, AI Summary, Profile URL, Status, Notes.
  - Dynamic file name: `candidates-[job-slug]-[date].xlsx`.
  - Proper column widths and readable formatting.
- **Alert / Feedback**:
  - **Success Toast**: `Downloading candidate export spreadsheet...`

---

## 3. End-to-End Scenario Walkthrough (Gherkin Format)

```gherkin
Scenario: Recruiter sources candidates for a Senior Backend role
  Given Sarah is logged into the AI Candidate platform
  When Sarah uploads a job description PDF named "Senior_Go_Engineer.pdf"
  Then the system displays an alert "Extracted job spec from Senior_Go_Engineer.pdf"
  And the system displays the extracted requirements (Go, PostgreSQL, Docker, 5+ years)
  When Sarah reviews the requirements and clicks "Generate Queries"
  Then the system generates 3 search queries and alerts "3 search queries generated!"
  When Sarah clicks "Find Candidates"
  Then the search executes in the background and notifies "Found 15 candidates! AI scoring completed."
  When Sarah shortlists the top 5 candidates and clicks "Export Excel"
  Then the system downloads "candidates-senior-go-engineer-2026-09-21.xlsx"
  And displays an alert "Downloading candidate export spreadsheet..."
```
