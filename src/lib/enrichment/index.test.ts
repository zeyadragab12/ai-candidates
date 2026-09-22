import { afterEach, describe, expect, it, vi } from "vitest";

async function loadFactoryWithEnv(extraEnv: Record<string, unknown> = {}) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: { ...extraEnv },
  }));
  return import("./index");
}

describe("getEnrichmentProvider", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });

  it("returns null when neither APIFY_API_TOKEN nor APIFY_ACTOR_ID is set (enrichment disabled)", async () => {
    const { getEnrichmentProvider } = await loadFactoryWithEnv();
    expect(getEnrichmentProvider()).toBeNull();
  });

  it("throws when only APIFY_API_TOKEN is set", async () => {
    const { getEnrichmentProvider } = await loadFactoryWithEnv({
      APIFY_API_TOKEN: "test-token",
    });
    expect(() => getEnrichmentProvider()).toThrow(/requires both/);
  });

  it("throws when only APIFY_ACTOR_ID is set", async () => {
    const { getEnrichmentProvider } = await loadFactoryWithEnv({
      APIFY_ACTOR_ID: "some-actor",
    });
    expect(() => getEnrichmentProvider()).toThrow(/requires both/);
  });

  it("returns an ApifyLinkedInProvider when both are set", async () => {
    const { getEnrichmentProvider } = await loadFactoryWithEnv({
      APIFY_API_TOKEN: "test-token",
      APIFY_ACTOR_ID: "some-actor",
    });
    const provider = getEnrichmentProvider();
    expect(provider?.constructor.name).toBe("ApifyLinkedInProvider");
  });

  it("caches the provider instance across calls", async () => {
    const { getEnrichmentProvider } = await loadFactoryWithEnv({
      APIFY_API_TOKEN: "test-token",
      APIFY_ACTOR_ID: "some-actor",
    });
    expect(getEnrichmentProvider()).toBe(getEnrichmentProvider());
  });
});
