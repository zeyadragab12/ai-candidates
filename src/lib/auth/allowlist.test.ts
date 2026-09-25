import { describe, expect, it } from "vitest";

import { isEmailAllowed, isRejectedSignup } from "@/lib/auth/allowlist";

describe("isEmailAllowed", () => {
  it("matches allowlisted emails case- and whitespace-insensitively", () => {
    expect(isEmailAllowed("  Zeyad.Ragab@thegdevelopments.com ")).toBe(true);
    expect(isEmailAllowed("stranger@example.com")).toBe(false);
    expect(isEmailAllowed(null)).toBe(false);
  });
});

describe("isRejectedSignup", () => {
  it("flags an un-allowlisted, unassigned default profile", () => {
    expect(isRejectedSignup({ email: "stranger@gmail.com", role: "hr_user", team_id: null })).toBe(true);
  });

  it("keeps allowlisted users even before they have a team", () => {
    expect(isRejectedSignup({ email: "zeyadboyka6@gmail.com", role: "hr_user", team_id: null })).toBe(false);
  });

  it("keeps anyone an admin has placed in a team or given a role", () => {
    expect(isRejectedSignup({ email: "old.test@example.com", role: "hr_user", team_id: "t1" })).toBe(false);
    expect(isRejectedSignup({ email: "old.test@example.com", role: "hr_manager", team_id: null })).toBe(false);
  });
});
