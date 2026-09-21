import { afterEach, describe, expect, it, vi } from "vitest";

async function loadFactoryWithProvider(
  searchProvider: string,
  extraEnv: Record<string, unknown> = {},
) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: { SEARCH_PROVIDER: searchProvider, ...extraEnv },
  }));
  return import("./index");
}

describe("getSearchProvider", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });

  it("returns a MockSearchProvider when SEARCH_PROVIDER=mock", async () => {
    const { getSearchProvider } = await loadFactoryWithProvider("mock");
    const provider = getSearchProvider();
    expect(provider.constructor.name).toBe("MockSearchProvider");
    const results = await provider.searchCandidates({ query: "test" });
    expect(results.length).toBeGreaterThan(0);
  });

  it("throws a clear error when SEARCH_PROVIDER=serpapi but SERPAPI_API_KEY is missing (never falls back to mock)", async () => {
    const { getSearchProvider } = await loadFactoryWithProvider("serpapi", {
      SERPAPI_API_KEY: undefined,
    });
    expect(() => getSearchProvider()).toThrow(/SERPAPI_API_KEY is not set/);
  });

  it("returns a SerpApiProvider when SEARCH_PROVIDER=serpapi and SERPAPI_API_KEY is set", async () => {
    const { getSearchProvider } = await loadFactoryWithProvider("serpapi", {
      SERPAPI_API_KEY: "test-key",
    });
    const provider = getSearchProvider();
    expect(provider.constructor.name).toBe("SerpApiProvider");
  });

  it("throws a clear error when SEARCH_PROVIDER=serper (not implemented yet)", async () => {
    const { getSearchProvider } = await loadFactoryWithProvider("serper");
    expect(() => getSearchProvider()).toThrow(/SerperProvider is not implemented/);
  });

  it("caches the provider instance across calls", async () => {
    const { getSearchProvider } = await loadFactoryWithProvider("mock");
    expect(getSearchProvider()).toBe(getSearchProvider());
  });
});
