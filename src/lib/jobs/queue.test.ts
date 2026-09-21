import { describe, expect, it, vi } from "vitest";

import { getJobQueue } from "./queue";

describe("InProcessQueue (via getJobQueue)", () => {
  it("returns the same queue instance across calls (singleton)", () => {
    expect(getJobQueue()).toBe(getJobQueue());
  });

  it("enqueue() returns immediately without waiting for the task to finish", () => {
    const queue = getJobQueue();
    let taskFinished = false;

    const before = Date.now();
    queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      taskFinished = true;
    });
    const elapsed = Date.now() - before;

    expect(elapsed).toBeLessThan(20);
    expect(taskFinished).toBe(false);
  });

  it("eventually runs the enqueued task", async () => {
    const queue = getJobQueue();
    let ran = false;

    queue.enqueue(async () => {
      ran = true;
    });

    await vi.waitFor(() => expect(ran).toBe(true));
  });

  it("catches a rejected task instead of producing an unhandled rejection", async () => {
    const queue = getJobQueue();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    queue.enqueue(async () => {
      throw new Error("simulated background task failure");
    });

    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it("includes the enqueuing request's correlation id in the failure log", async () => {
    const queue = getJobQueue();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    queue.enqueue(async () => {
      throw new Error("simulated background task failure");
    }, "req-abc");

    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    const logged = consoleSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("req-abc");
    consoleSpy.mockRestore();
  });
});
