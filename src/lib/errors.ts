import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AIProviderError, AIResponseValidationError } from "@/lib/ai/AIProvider";
import { FileExtractionError, UnsupportedFileTypeError } from "@/lib/files/extract";
import {
  createLogger,
  generateRequestId,
  getOrCreateRequestId,
  REQUEST_ID_RESPONSE_HEADER,
  type RequestLogger,
} from "@/lib/logger";
import { SearchProviderError } from "@/lib/search/SearchProvider";

/** Thrown by rate-limiting middleware (step 7.2) — handled here already so
 * that step can just throw it without touching every route. */
export class RateLimitError extends Error {
  constructor(retryAfterSeconds?: number) {
    super("Too many requests.");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
  retryAfterSeconds?: number;
}

interface PostgrestLikeError {
  code: string;
  message: string;
}

function isPostgrestLikeError(error: unknown): error is PostgrestLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

/**
 * Maps any thrown error to a safe, client-facing JSON response. This is the
 * single place that decides what a client is allowed to see: full error
 * details (including stack traces) are always logged server-side, but the
 * response body only ever contains a short, generic, non-identifying
 * message. A stack trace, file path, or API key must never appear in a
 * response body — if a new error type needs a specific message, it gets
 * added here, not by letting the raw error through.
 */
export function handleApiError(
  error: unknown,
  context?: string,
  logger?: RequestLogger,
): NextResponse {
  const log = logger ?? createLogger("no-request-id");
  log.error(context ? `Request failed: ${context}` : "Request failed", { error });

  if (error instanceof UnsupportedFileTypeError || error instanceof FileExtractionError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof AIResponseValidationError) {
    return NextResponse.json(
      { error: "The AI returned an unexpected response. Please try again." },
      { status: 502 },
    );
  }

  if (error instanceof AIProviderError) {
    return NextResponse.json(
      { error: "The AI service is currently unavailable. Please try again shortly." },
      { status: 502 },
    );
  }

  if (error instanceof SearchProviderError) {
    return NextResponse.json(
      { error: "The search provider is currently unavailable. Please try again shortly." },
      { status: 502 },
    );
  }

  if (error instanceof RateLimitError) {
    const headers = error.retryAfterSeconds
      ? { "Retry-After": String(error.retryAfterSeconds) }
      : undefined;
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  if (isPostgrestLikeError(error)) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This record already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "A database error occurred." }, { status: 500 });
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return NextResponse.json(
      { error: "The request took too long. Please try again." },
      { status: 504 },
    );
  }

  // Unknown/unexpected error: never forward error.message or error.stack —
  // either could contain internal paths, query fragments, or other details
  // that were never meant to be client-visible.
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (...args: any[]) => Promise<Response> | Response;

/**
 * Wraps an API route handler so:
 * - any exception it throws — including ones no existing try/catch
 *   anticipated — is converted to a safe response via handleApiError
 *   instead of propagating to Next.js's own error handling (which can
 *   include stack traces in its response body in dev mode);
 * - every request gets a correlation ID (reused from an inbound
 *   `x-request-id` header if present), echoed back as `X-Request-Id` and
 *   attached to every structured log line for that request, so a single ID
 *   can be grepped across a request's full lifecycle — including
 *   background work it enqueues (see getJobQueue).
 *
 * The handler receives that request's logger as an extra argument after
 * whatever Next.js itself passes (request, routeContext); existing handlers
 * that don't declare a third parameter are unaffected.
 */
export function withErrorHandling<T extends RouteHandler>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as Request | undefined;
    const requestId = request ? getOrCreateRequestId(request) : generateRequestId();
    const logger = createLogger(requestId);
    const label = request
      ? `${request.method} ${new URL(request.url).pathname}`
      : undefined;
    const startedAt = Date.now();

    try {
      const response = await handler(...args, logger);
      if (label) {
        logger.info(label, { status: response.status, durationMs: Date.now() - startedAt });
      }
      response.headers.set(REQUEST_ID_RESPONSE_HEADER, requestId);
      return response;
    } catch (error) {
      const response = handleApiError(error, label, logger);
      response.headers.set(REQUEST_ID_RESPONSE_HEADER, requestId);
      return response;
    }
  }) as T;
}
