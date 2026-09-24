// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RequirementsEditor } from "./RequirementsEditor";
import type { JobAnalysis } from "@/types/job-analysis";

function makeAnalysis(overrides: Partial<JobAnalysis> = {}): JobAnalysis {
  return {
    job_title: "Frontend Developer",
    seniority: "Mid",
    location: "Egypt",
    city: "Cairo",
    employment_type: "Full-time",
    required_skills: ["React", "TypeScript"],
    preferred_skills: [],
    years_of_experience: { minimum: 3, maximum: null },
    education: [],
    certifications: [],
    languages: [],
    industries: [],
    keywords: [],
    responsibilities: [],
    search_keywords: [],
    search_queries: [],
    ...overrides,
  };
}

/**
 * Mimics how the real /jobs/new page uses RequirementsEditor: it owns the
 * state and feeds updates back in, so the controlled inputs actually reflect
 * user input across renders (a bare unchanging mock value would not).
 */
function StatefulHarness({
  initial,
  onChangeSpy,
}: {
  initial: JobAnalysis;
  onChangeSpy: (updated: JobAnalysis) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <RequirementsEditor
      value={value}
      onChange={(updated) => {
        setValue(updated);
        onChangeSpy(updated);
      }}
    />
  );
}

describe("RequirementsEditor", () => {
  it("edits an existing skill and reflects it in the payload", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={makeAnalysis()} onChangeSpy={onChangeSpy} />,
    );

    const firstSkillInput = screen.getByTestId(
      "requirements-required_skills-item-0",
    );
    await user.clear(firstSkillInput);
    await user.type(firstSkillInput, "Vue");

    const lastCall = onChangeSpy.mock.calls.at(-1)?.[0] as JobAnalysis;
    expect(lastCall.required_skills).toEqual(["Vue", "TypeScript"]);
  });

  it("removes a skill and reflects it in the payload", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={makeAnalysis()} onChangeSpy={onChangeSpy} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove React" }));

    expect(onChangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ required_skills: ["TypeScript"] }),
    );
  });

  it("adds a new skill and reflects it in the payload", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={makeAnalysis()} onChangeSpy={onChangeSpy} />,
    );

    const addInput = screen.getByTestId(
      "requirements-required_skills-add-input",
    );
    await user.type(addInput, "Next.js");
    await user.click(
      screen.getByTestId("requirements-required_skills-add-button"),
    );

    expect(onChangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        required_skills: ["React", "TypeScript", "Next.js"],
      }),
    );
  });

  it("does not add an empty skill", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={makeAnalysis()} onChangeSpy={onChangeSpy} />,
    );

    await user.click(
      screen.getByTestId("requirements-required_skills-add-button"),
    );

    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("edits the job title field", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={makeAnalysis()} onChangeSpy={onChangeSpy} />,
    );

    const titleInput = screen.getByLabelText("Job Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Backend Developer");

    const lastCall = onChangeSpy.mock.calls.at(-1)?.[0] as JobAnalysis;
    expect(lastCall.job_title).toBe("Backend Developer");
  });
});
