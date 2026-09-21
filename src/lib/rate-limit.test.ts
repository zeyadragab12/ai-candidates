import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  InMemoryRateLimiter,
  enforceRateLimit,
  getRateLimiter,
} from "./rate-limit";
import { RateLimitError } from "@/lib/errors";

describe("InMemoryRateLimiter", () => {
  it("allows requests up to the limit", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i++) {
      const result = await limiter.check("user-1", 3, 60);
      expect(result.allowed).toBe(true);
    }
  });

  it("denies the request that exceeds the limit", async () => {
    const limiter = new InMemoryRateLimiter();
    await limiter.check("user-1", 3, 60);
    await limiter.check("user-1", 3, 60);
    await limiter.check("user-1", 3, 60);

    const fourth = await limiter.check("user-1", 3, 60);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks different keys independently", async () => {
    const limiter = new InMemoryRateLimiter();
    await limiter.check("user-1", 1, 60);
    const user1Second = await limiter.check("user-1", 1, 60);
    const user2First = await limiter.check("user-2", 1, 60);

    expect(user1Second.allowed).toBe(false);
    expect(user2First.allowed).toBe(true);
  });

  it("allows requests again once the window has passed", async () => {
    vi.useFakeTimers();
    try {
      const limiter = new InMemoryRateLimiter();
      await limiter.check("user-1", 1, 10);
      const blocked = await limiter.check("user-1", 1, 10);
      expect(blocked.allowed).toBe(false);

      vi.advanceTimersByTime(10_001);

      const afterWindow = await limiter.check("user-1", 1, 10);
      expect(afterWindow.allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports decreasing remaining count as requests are made", async () => {
    const limiter = new InMemoryRateLimiter();
    const first = await limiter.check("user-1", 5, 60);
    const second = await limiter.check("user-1", 5, 60);
    expect(first.remaining).toBe(4);
    expect(second.remaining).toBe(3);
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not throw while under the limit", async () => {
    const key = `test-key-${Math.random()}`;
    await expect(enforceRateLimit(key, 3, 60)).resolves.toBeUndefined();
    await expect(enforceRateLimit(key, 3, 60)).resolves.toBeUndefined();
  });

  it("throws RateLimitError once the limit is exceeded", async () => {
    const key = `test-key-${Math.random()}`;
    await enforceRateLimit(key, 2, 60);
    await enforceRateLimit(key, 2, 60);
    await expect(enforceRateLimit(key, 2, 60)).rejects.toThrow(RateLimitError);
  });

  it("uses the same underlying limiter instance across calls (getRateLimiter is a singleton)", () => {
    expect(getRateLimiter()).toBe(getRateLimiter());
  });
});
