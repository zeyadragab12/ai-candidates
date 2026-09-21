// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Filters, DEFAULT_CANDIDATE_FILTERS } from "./Filters";

describe("Filters", () => {
  it("does not call onChange while typing (only on Apply)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Filters value={DEFAULT_CANDIDATE_FILTERS} onChange={onChange} />);
    await user.type(screen.getByTestId("filter-name"), "Amina");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies multiple filters together (combined, not overriding each other)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Filters value={DEFAULT_CANDIDATE_FILTERS} onChange={onChange} />);
    await user.type(screen.getByTestId("filter-name"), "Amina");
    await user.type(screen.getByTestId("filter-location"), "Cairo");
    await user.click(screen.getByTestId("filter-apply"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Amina", location: "Cairo" }),
    );
  });

  it("changing sort field applies immediately without needing Apply", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Filters value={DEFAULT_CANDIDATE_FILTERS} onChange={onChange} />);
    await user.click(screen.getByTestId("filter-sort-direction"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortDir: "asc" }),
    );
  });

  it("clear resets all text filters but preserves the current sort", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Filters
        value={{ ...DEFAULT_CANDIDATE_FILTERS, name: "Amina", sortDir: "asc" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId("filter-clear"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "", sortDir: "asc" }),
    );
  });
});
