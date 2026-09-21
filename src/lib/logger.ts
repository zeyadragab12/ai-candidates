/**
 * Minimal structured logger: every line is a single JSON object with a
 * level, message, timestamp, and a requestId that ties together every log
 * line emitted while handling one request (including background work
 * enqueued by it, e.g. an async search run). No external log shipper is
 * wired up yet — this just gets the shape right so one can be added later
 * (e.g. piping console output to a log aggregator) without touching call
 * sites.
 */

export type LogLevel = "info" | "warn" | "error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LogMeta = Record<string, any>;

export interface RequestLogger {
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

const REQUEST_ID_HEADER = "x-request-id";

export function generateRequestId(): string {
  return crypto.randomUUID();
}

/** Reuses an inbound `x-request-id` header if a caller/proxy already set
 * one (so a client-generated ID can be traced end to end), otherwise mints
 * a new one. */
export function getOrCreateRequestId(request: Request): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? generateRequestId();
}

/** Recursively unwraps `error.cause` chains (e.g. AIProviderError wrapping
 * the underlying SDK error) so the actual root cause ends up in the log
 * line instead of just the generic outer wrapper message. */
function serializeError(error: Error): LogMeta {
  const serialized: LogMeta = { name: error.name, message: error.message };
  if (error.cause !== undefined) {
    serialized.cause =
      error.cause instanceof Error ? serializeError(error.cause) : error.cause;
  }
  return serialized;
}

function serializeMeta(meta?: LogMeta): LogMeta {
  if (!meta) return {};
  const serialized: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    serialized[key] = value instanceof Error ? serializeError(value) : value;
  }
  return serialized;
}

function write(level: LogLevel, requestId: string, message: string, meta?: LogMeta): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    requestId,
    message,
    ...serializeMeta(meta),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(requestId: string): RequestLogger {
  return {
    info: (message, meta) => write("info", requestId, message, meta),
    warn: (message, meta) => write("warn", requestId, message, meta),
    error: (message, meta) => write("error", requestId, message, meta),
  };
}

export const REQUEST_ID_RESPONSE_HEADER = "X-Request-Id";
