const RETRYABLE_HTTP_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * Status codes that are worth retrying: rate limits and transient
 * server-side/network failures. Anything else (400, 401, 403, 404, ...) is a
 * problem retrying won't fix, so callers should let it fail immediately.
 */
export function isRetryableStatus(status: number | undefined): boolean {
  return status !== undefined && RETRYABLE_HTTP_STATUSES.has(status);
}

export interface RetryOptions {
  /** Total attempts including the first, non-retry call. */
  maxAttempts: number;
  /** Delay before the first retry. Doubles on each subsequent retry. */
  baseDelayMs: number;
  /** Ceiling applied after doubling, so backoff can't grow unbounded. */
  maxDelayMs: number;
  /** Decides whether a given error is worth retrying at all. */
  isRetryable: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying on transient failures with exponential backoff plus
 * jitter (so concurrent callers retrying after the same failure don't all
 * hammer the provider at the exact same instant). Non-retryable errors and
 * the final attempt's error both propagate to the caller unchanged.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === options.maxAttempts || !options.isRetryable(error)) {
        throw error;
      }

      const delay = Math.min(
        options.baseDelayMs * 2 ** (attempt - 1),
        options.maxDelayMs,
      );
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5);
      await sleep(jitteredDelay);
    }
  }

  // Unreachable (the loop always returns or throws), but keeps TypeScript
  // happy without an unsafe non-null assertion.
  throw lastError;
}
