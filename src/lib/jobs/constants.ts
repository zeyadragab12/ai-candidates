import { EGYPT_GOVERNORATES } from "@/lib/candidates/egyptLocations";

// Shared by the New Job form's "Job Details" section and the AI-extracted
// "Requirements Editor" section, so both dropdowns offer the same choices.
export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
export const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "On-site"];

// Governorates first (what actually biases a SerpApi search, see
// locationBias.ts), then "Egypt" for nationwide targeting, then the
// non-geographic values shouldApplyLocationBias() already treats as "don't
// bias by location" — offered here so a recruiter can pick them explicitly
// instead of typing free text.
export const LOCATION_OPTIONS = [...EGYPT_GOVERNORATES, "Egypt", "Remote", "Global"];
