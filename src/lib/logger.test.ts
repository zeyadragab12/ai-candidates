import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger, generateRequestId, getOrCreateRequestId } from "./logger";

describe("generateRequestId", () => {
  it("returns a UUID-shaped string", () => {
    expect(generateRequestId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns a different id each call", () => {
    expect(generateRequestId()).not.toBe(generateRequestId());
  });
});

describe("getOrCreateRequestId", () => {
  it("reuses an inbound x-request-id header", () => {
    const request = new Request("http://localhost/api/test", {
      headers: { "x-request-id": "abc-123" },
    });
    expect(getOrCreateRequestId(request)).toBe("abc-123");
  });

  it("mints a new id when no header is present", () => {
    const request = new Request("http://localhost/api/test");
    expect(getOrCreateRequestId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("createLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a single JSON line with level, requestId, message, and meta", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createLogger("req-1");

    logger.info("search started", { jobId: "job-1" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed).toMatchObject({
      level: "info",
      requestId: "req-1",
      message: "search started",
      jobId: "job-1",
    });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("routes warn and error to their matching console methods", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("req-1");

    logger.warn("slow query");
    logger.error("search failed");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("serializes an Error in meta to its name/message instead of an opaque object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("req-1");

    logger.error("provider call failed", { error: new Error("rate limited") });

    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.error).toEqual({ name: "Error", message: "rate limited" });
  });

  it("unwraps a chained error.cause instead of hiding it behind the wrapper's message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("req-1");

    const rootCause = new Error("model not found: gemini-3.6-flash");
    const wrapper = new Error("AI provider \"gemini\" failed to generate a response.");
    wrapper.cause = rootCause;

    logger.error("Request failed", { error: wrapper });

    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.error.message).toContain("failed to generate a response");
    expect(parsed.error.cause).toEqual({
      name: "Error",
      message: "model not found: gemini-3.6-flash",
    });
  });
});
