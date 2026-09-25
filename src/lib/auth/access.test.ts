import { describe, expect, it } from "vitest";

import { isAccessRequest } from "@/lib/auth/access";

describe("isAccessRequest", () => {
  it("is an uninvited sign-in: inactive, no team, default role", () => {
    expect(isAccessRequest({ is_active: false, team_id: null, role: "hr_user" })).toBe(true);
  });

  it("excludes active users", () => {
    expect(isAccessRequest({ is_active: true, team_id: null, role: "hr_user" })).toBe(false);
  });

  it("excludes deactivated users an admin had placed in a team or given a role", () => {
    expect(isAccessRequest({ is_active: false, team_id: "t1", role: "hr_user" })).toBe(false);
    expect(isAccessRequest({ is_active: false, team_id: null, role: "hr_manager" })).toBe(false);
  });
});
