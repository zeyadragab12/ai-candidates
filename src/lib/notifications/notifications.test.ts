import { describe, expect, it } from "vitest";

import { notificationHref } from "@/lib/notifications/notifications";

const base = {
  user_id: "actor-1",
  action: "sourcing_run.completed",
  description: "Completed a sourcing run",
  metadata: null,
};

describe("notificationHref", () => {
  it("opens the sourcing file for run events that know their job", () => {
    expect(
      notificationHref({ ...base, entity_type: "search_run", entity_id: "run-1", metadata: { jobId: "job-1" } }),
    ).toBe("/candidates?jobId=job-1&runId=run-1");
  });

  it("opens the job's candidates for scoring events", () => {
    expect(notificationHref({ ...base, entity_type: "job", entity_id: "job-1" })).toBe("/candidates?jobId=job-1");
  });

  it("opens the candidate for shortlist events", () => {
    expect(notificationHref({ ...base, entity_type: "candidate", entity_id: "cand-1" })).toBe("/candidates/cand-1");
  });

  it("falls back to the team member's page when the target is unknown", () => {
    expect(notificationHref({ ...base, entity_type: "search_run", entity_id: "run-1" })).toBe("/manager/team/actor-1");
    expect(notificationHref({ ...base, user_id: null, entity_type: "other", entity_id: null })).toBe("/manager");
  });
});
