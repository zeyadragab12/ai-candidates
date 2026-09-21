// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchQueries } from "./SearchQueries";

function StatefulHarness({
  initial,
  onChangeSpy,
}: {
  initial: string[];
  onChangeSpy: (updated: string[]) => void;
}) {
  const [queries, setQueries] = useState(initial);
  return (
    <SearchQueries
      queries={queries}
      onChange={(updated) => {
        setQueries(updated);
        onChangeSpy(updated);
      }}
    />
  );
}

const INITIAL_QUERIES = [
  "React Developer Cairo",
  "Frontend Developer TypeScript Egypt",
];

describe("SearchQueries", () => {
  it("edits an existing query and reflects it in the payload", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={INITIAL_QUERIES} onChangeSpy={onChangeSpy} />,
    );

    const firstQueryInput = screen.getByTestId("search-query-item-0");
    await user.clear(firstQueryInput);
    await user.type(firstQueryInput, "Edited Query");

    const lastCall = onChangeSpy.mock.calls.at(-1)?.[0] as string[];
    expect(lastCall).toEqual([
      "Edited Query",
      "Frontend Developer TypeScript Egypt",
    ]);
  });

  it("removes a query and reflects it in the payload", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={INITIAL_QUERIES} onChangeSpy={onChangeSpy} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Remove query: React Developer Cairo",
      }),
    );

    expect(onChangeSpy).toHaveBeenCalledWith([
      "Frontend Developer TypeScript Egypt",
    ]);
  });

  it("adds a custom query and reflects it in the payload", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={INITIAL_QUERIES} onChangeSpy={onChangeSpy} />,
    );

    await user.type(
      screen.getByTestId("search-query-add-input"),
      "Custom Recruiter Query",
    );
    await user.click(screen.getByTestId("search-query-add-button"));

    expect(onChangeSpy).toHaveBeenCalledWith([
      ...INITIAL_QUERIES,
      "Custom Recruiter Query",
    ]);
  });

  it("does not add an empty query", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(
      <StatefulHarness initial={INITIAL_QUERIES} onChangeSpy={onChangeSpy} />,
    );

    await user.click(screen.getByTestId("search-query-add-button"));

    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("shows an empty state when there are no queries", () => {
    render(<StatefulHarness initial={[]} onChangeSpy={vi.fn()} />);
    expect(
      screen.getByText("No search queries yet. Add one below."),
    ).toBeTruthy();
  });
});
