import { describe, expect, it, vi } from "vitest";

import { isRetryableStatus, withRetry } from "./retry";

describe("isRetryableStatus", () => {
  it("treats rate limits and server errors as retryable", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("treats client errors and undefined as non-retryable", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(undefined)).toBe(false);
  });
});

describe("withRetry", () => {
  const options = {
    maxAttempts: 3,
    baseDelayMs: 1,
    maxDelayMs: 5,
    isRetryable: () => true,
  };

  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, options);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable failure and returns the eventual success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, options);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stops after maxAttempts and throws the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(withRetry(fn, options)).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(options.maxAttempts);
  });

  it("does not retry when isRetryable returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("not worth retrying"));

    await expect(
      withRetry(fn, { ...options, isRetryable: () => false }),
    ).rejects.toThrow("not worth retrying");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
