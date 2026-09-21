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

### Epic 1: Intelligent Job Specification & Streamlined Ingestion

#### Story 1.1: Collapsible Job Details & Company Specification
> **As Sarah (Recruiter)**,
> **I want to** specify the role title, company name, employment type, and work arrangement in an expandable/collapsible list,
> **So that** I can configure the company parameters cleanly and collapse them once done.

- **Acceptance Criteria**:
  - Job Details accordion includes: Job Title, Company Name, Employment Type, and Work Arrangement.
  - Can be expanded and collapsed at any time with real-time summary indicators.
  - Collapses automatically when "Analyze Job" is clicked.

#### Story 1.2: Redesigned File Dropzone & Job Description Input
> **As Sarah (Recruiter)**,
> **I want to** upload a PDF/DOCX or paste text in an intuitive, responsive upload area,
> **So that** I can provide role specs effortlessly.

- **Acceptance Criteria**:
  - Drag-and-drop file dropzone supporting PDF, DOCX, and TXT files.
  - Interactive file chip displaying file name, size, and one-click remove/replace options.
  - Collapsible accordion with character counts and text preview.
- **Alert / Feedback**:
  - **Success Toast**: `Extracted content from [filename]` upon parsing.

#### Story 1.3: Animated Analysis Load Screen & Clean Requirements Display
> **As Sarah (Recruiter)**,
> **I want** the input forms to collapse and display a sleek loading animation during analysis, followed by an un-cluttered requirements view,
> **So that** I don't feel overwhelmed by massive walls of empty inputs.

- **Acceptance Criteria**:
  - Clicking "Analyze Job" collapses both accordions and triggers an animated AI loading card.
  - Extracted requirements are displayed in an elegant tabbed layout (Skills & Technologies, Education & Qualifications, Responsibilities & Keywords).
  - Clean tag pills with one-click removal and inline addition.

---

### Epic 2: Automated Sourcing & Sourcing Completion Alert

#### Story 2.1: One-Click Autonomous Sourcing (No Manual Query Clutter)
> **As Sarah (Recruiter)**,
> **I want to** click a single button to generate queries and find candidates automatically without reviewing raw search query syntax,
> **So that** the entire sourcing process happens seamlessly in the background.

- **Acceptance Criteria**:
  - No raw search query form is displayed.
  - System automatically generates targeted queries, saves the role, queries authorized providers, and scores candidate matches.
  - Real-time step status banner displayed during the background run.

#### Story 2.2: Centered Sourcing Completion Modal with Action Buttons
> **As Sarah (Recruiter)**,
> **I want** a prominent centered alert to appear upon search completion displaying the number of candidates found and giving me immediate actions,
> **So that** I know exactly how many candidates were found and can jump straight to reviewing them.

- **Acceptance Criteria**:
  - Centered modal with backdrop blur.
  - Displays: "Candidate Sourcing Complete!", the role title, company, and the exact count of candidates found.
  - **Button 1 ("Close")**: Dismisses the modal.
  - **Button 2 ("Show Candidates")**: Directly navigates to `/candidates?jobId=[jobId]`.

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
