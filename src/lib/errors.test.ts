import { describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";

import {
  handleApiError,
  withErrorHandling,
  RateLimitError,
} from "./errors";
import { AIProviderError, AIResponseValidationError } from "@/lib/ai/AIProvider";
import { FileExtractionError, UnsupportedFileTypeError } from "@/lib/files/extract";
import { SearchProviderError } from "@/lib/search/SearchProvider";

async function bodyOf(response: Response) {
  return response.json();
}

describe("handleApiError", () => {
  it("maps UnsupportedFileTypeError to 400 with its own safe message", async () => {
    const res = handleApiError(new UnsupportedFileTypeError("exe"));
    expect(res.status).toBe(400);
    expect((await bodyOf(res)).error).toContain("Unsupported file type");
  });

  it("maps FileExtractionError (corrupt file) to 400", async () => {
    const res = handleApiError(new FileExtractionError("pdf"));
    expect(res.status).toBe(400);
  });

  it("maps AIResponseValidationError (invalid AI JSON) to 502 with a generic message, not the raw Zod issue", async () => {
    const res = handleApiError(new AIResponseValidationError("job-analysis", new Error("internal zod detail")));
    expect(res.status).toBe(502);
    const body = await bodyOf(res);
    expect(body.error).not.toContain("internal zod detail");
    expect(body.error).toContain("unexpected response");
  });

  it("maps AIProviderError (AI API error) to 502 without leaking the underlying cause", async () => {
    const res = handleApiError(
      new AIProviderError("gemini", new Error("API key AIzaSyABC123 invalid")),
    );
    const body = await bodyOf(res);
    expect(res.status).toBe(502);
    expect(body.error).not.toContain("AIzaSyABC123");
  });

  it("maps SearchProviderError to 502 without leaking the underlying cause", async () => {
    const res = handleApiError(
      new SearchProviderError("serpapi", new Error("api_key=secret123 rejected")),
    );
    const body = await bodyOf(res);
    expect(res.status).toBe(502);
    expect(body.error).not.toContain("secret123");
  });

  it("maps RateLimitError to 429 with a Retry-After header when provided", async () => {
    const res = handleApiError(new RateLimitError(30));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("maps a ZodError (invalid input) to 400 with the first issue's message", async () => {
    const schema = z.object({ jobDescriptionText: z.string().min(50) });
    const result = schema.safeParse({ jobDescriptionText: "short" });
    const res = handleApiError(result.error as ZodError);
    expect(res.status).toBe(400);
  });

  it("maps a Postgres unique-violation (duplicate) to 409, not a raw DB error", async () => {
    const res = handleApiError({
      code: "23505",
      message: "duplicate key value violates unique constraint \"candidates_pkey\" on table candidates",
    });
    const body = await bodyOf(res);
    expect(res.status).toBe(409);
    expect(body.error).not.toContain("candidates_pkey");
    expect(body.error).not.toContain("constraint");
  });

  it("maps other Postgres/database errors to a generic 500, never the raw message", async () => {
    const res = handleApiError({
      code: "42501",
      message: "permission denied for table jobs at /internal/path/db.ts:42",
    });
    const body = await bodyOf(res);
    expect(res.status).toBe(500);
    expect(body.error).not.toContain("/internal/path");
    expect(body.error).not.toContain("permission denied");
  });

  it("maps a DOMException TimeoutError to 504", async () => {
    const res = handleApiError(new DOMException("The operation timed out.", "TimeoutError"));
    expect(res.status).toBe(504);
  });

  it("never leaks a stack trace, message, or internal path for a totally unknown/unexpected error", async () => {
    const weirdError = new TypeError(
      "Cannot read properties of undefined (reading 'foo') at /Users/zeyad/AI-Candidate/src/secret-module.ts:123:45",
    );
    const res = handleApiError(weirdError);
    const body = await bodyOf(res);

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret-module.ts");
    expect(JSON.stringify(body)).not.toContain("Cannot read properties");
    expect(body.error).toBe("Something went wrong. Please try again.");
  });

  it("never leaks anything for a plain thrown string (not even an Error instance)", async () => {
    const res = handleApiError("some raw string with /etc/passwd in it");
    const body = await bodyOf(res);
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("/etc/passwd");
  });

  it("logs the full error server-side even though the client response is generic", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("full internal detail for developers");
    handleApiError(err, "POST /api/test");
    expect(consoleSpy).toHaveBeenCalled();
    const loggedLine = consoleSpy.mock.calls.flat().join(" ");
    expect(loggedLine).toContain("full internal detail for developers");
    consoleSpy.mockRestore();
  });
});

describe("withErrorHandling", () => {
  it("passes through a successful response unchanged", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handler = withErrorHandling(async (_request: Request) => new Response("ok", { status: 200 }));
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(200);
  });

  it("catches an uncaught throw and converts it to a safe response instead of propagating", async () => {
    const handler = withErrorHandling(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_request: Request): Promise<Response> => {
        throw new Error("unexpected bug with /Users/secret/path leaked");
      },
    );
    const res = await handler(new Request("http://localhost/api/test"));
    const body = await bodyOf(res);

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("/Users/secret/path");
  });

  it("still recognizes known error types thrown deep inside the handler", async () => {
    const handler = withErrorHandling(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_request: Request): Promise<Response> => {
        throw new UnsupportedFileTypeError("bmp");
      },
    );
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(400);
  });

  it("works for handlers with a second (params) argument, as used by dynamic routes", async () => {
    const handler = withErrorHandling(
      async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
        const { id } = await params;
        if (id === "boom") throw new Error("simulated failure");
        return new Response(id, { status: 200 });
      },
    );

    const okRes = await handler(new Request("http://localhost/api/candidates/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(okRes.status).toBe(200);

    const errRes = await handler(new Request("http://localhost/api/candidates/boom"), {
      params: Promise.resolve({ id: "boom" }),
    });
    expect(errRes.status).toBe(500);
  });

  it("attaches a generated X-Request-Id to both success and error responses", async () => {
    const okHandler = withErrorHandling(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_request: Request) => new Response("ok", { status: 200 }),
    );
    const okRes = await okHandler(new Request("http://localhost/api/test"));
    expect(okRes.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);

    const errHandler = withErrorHandling(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_request: Request): Promise<Response> => {
        throw new Error("boom");
      },
    );
    const errRes = await errHandler(new Request("http://localhost/api/test"));
    expect(errRes.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reuses an inbound x-request-id header instead of minting a new one", async () => {
    const handler = withErrorHandling(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_request: Request) => new Response("ok", { status: 200 }),
    );
    const res = await handler(
      new Request("http://localhost/api/test", {
        headers: { "x-request-id": "client-provided-id" },
      }),
    );
    expect(res.headers.get("X-Request-Id")).toBe("client-provided-id");
  });

  it("passes a RequestLogger as an extra argument the handler can use", async () => {
    let receivedLogger: unknown;
    const handler = withErrorHandling(async (_request: Request, _ctx?: unknown, logger?: unknown) => {
      receivedLogger = logger;
      return new Response("ok", { status: 200 });
    });
    // Next.js always invokes route handlers with exactly (request, context);
    // withErrorHandling appends the logger as the argument after whatever
    // was actually passed in, so the test call shape must match that.
    await handler(new Request("http://localhost/api/test"), {});
    expect(receivedLogger).toMatchObject({
      info: expect.any(Function),
      warn: expect.any(Function),
      error: expect.any(Function),
    });
  });
});
