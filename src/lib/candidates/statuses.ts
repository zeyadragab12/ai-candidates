export const CANDIDATE_STATUSES = [
  "New",
  "Reviewed",
  "Shortlisted",
  "Rejected",
  "Contacted",
  "Hired",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];
