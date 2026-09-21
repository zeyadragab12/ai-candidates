import { RateLimitError } from "@/lib/errors";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Deliberately shaped close to Upstash's @upstash/ratelimit response
 * ({ success, remaining, reset }), so a future RateLimiter implementation
 * backed by real Upstash Redis is a drop-in swap — call sites only ever
 * call enforceRateLimit(), never touch a RateLimiter directly.
 */
export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

/**
 * In-memory, single-process rate limiter. Fine for the MVP's single-instance
 * deployment; not correct across multiple server instances (each would have
 * its own counters) — that's exactly the gap a real Upstash-backed
 * RateLimiter closes later, without any call-site changes.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();

  async check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const recentHits = (this.hits.get(key) ?? []).filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (recentHits.length >= limit) {
      this.hits.set(key, recentHits);
      const oldestHit = recentHits[0] as number;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowMs - (now - oldestHit)) / 1000),
      );
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    recentHits.push(now);
    this.hits.set(key, recentHits);
    return {
      allowed: true,
      remaining: limit - recentHits.length,
      retryAfterSeconds: 0,
    };
  }
}

let cachedLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!cachedLimiter) {
    cachedLimiter = new InMemoryRateLimiter();
  }
  return cachedLimiter;
}

/** Named presets for the categories the spec calls out. All AI-backed
 * endpoints (job analysis, search-query generation, candidate matching)
 * share one pool since they all draw from the same paid AI quota; search
 * and export are separate pools with their own real-world cost profiles. */
export const RATE_LIMITS = {
  aiRequest: { limit: 10, windowSeconds: 60 },
  searchRequest: { limit: 5, windowSeconds: 60 },
  export: { limit: 20, windowSeconds: 60 },
} as const;

/**
 * Throws RateLimitError if `key` has been hit `limit` or more times within
 * the last `windowSeconds`. This is the only thing route handlers call —
 * swapping getRateLimiter()'s in-memory implementation for a real
 * Upstash-backed one later requires no changes here or at any call site.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const result = await getRateLimiter().check(key, limit, windowSeconds);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
}
