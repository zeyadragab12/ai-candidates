/** Human-readable names for activity_log.action values. */
export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.login_failed": "Failed sign-in",
  "job.created": "Job created",
  "job.updated": "Job updated",
  "job.deleted": "Job deleted",
  "job.candidates_scored": "Candidates scored",
  "sourcing_run.started": "Sourcing run started",
  "sourcing_run.completed": "Sourcing run completed",
  "sourcing_run.failed": "Sourcing run failed",
  "sourcing_file.accessed": "Opened a teammate's sourcing file",
  "candidate.status_changed": "Candidate status changed",
  "candidate.note_added": "Candidate note added",
  "candidate.deleted": "Candidate deleted",
  "team.created": "Team created",
  "team.updated": "Team updated",
  "team.user_updated": "User role/team changed",
  "team.user_invited": "User invited",
  "team.access_granted": "Access granted",
  "team.invite_withdrawn": "Invite withdrawn",
  "report.viewed": "Report viewed",
  "report.exported": "Report exported",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
