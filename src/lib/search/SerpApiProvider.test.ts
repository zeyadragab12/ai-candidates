import { afterEach, describe, expect, it, vi } from "vitest";

import { SerpApiProvider } from "./SerpApiProvider";
import { SearchProviderError } from "./SearchProvider";

describe("SerpApiProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws immediately if constructed with an empty API key", () => {
    expect(() => new SerpApiProvider("")).toThrow(/SERPAPI_API_KEY is required/);
  });

  it("maps organic results into CandidateSearchResult, parsing name/title/company from the title", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          {
            title: "Amina Hassan - Senior React Developer - Nile Software Solutions | LinkedIn",
            link: "https://linkedin.com/in/amina-hassan",
            snippet: "5+ years building React apps.",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "React Developer Cairo" });

    expect(results).toEqual([
      {
        source: "serpapi",
        source_url: "https://linkedin.com/in/amina-hassan",
        name: "Amina Hassan",
        title: "Senior React Developer",
        company: "Nile Software Solutions",
        profile_url: "https://linkedin.com/in/amina-hassan",
        snippet: "5+ years building React apps.",
      },
    ]);
  });

  it("passes snippet_highlighted_words through as skills", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          {
            title: "Amina Hassan - Senior React Developer - Nile Software Solutions | LinkedIn",
            link: "https://linkedin.com/in/amina-hassan",
            snippet: "5+ years building React apps.",
            snippet_highlighted_words: ["React", "Developer"],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "React Developer Cairo" });

    expect(results[0]?.skills).toEqual(["React", "Developer"]);
  });

  it("leaves skills undefined when SerpApi doesn't return snippet_highlighted_words", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          {
            title: "Amina Hassan | LinkedIn",
            link: "https://linkedin.com/in/amina-hassan",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "x" });

    expect(results[0]?.skills).toBeUndefined();
  });

  it("does not invent name/title/company fields when the title doesn't contain them", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          {
            title: "React Developer - Amina Hassan | Personal Portfolio",
            link: "https://aminahassan.dev",
            snippet: "React developer portfolio.",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "React Developer Cairo" });

    expect(results[0]?.name).toBe("React Developer");
    expect(results[0]?.title).toBe("Amina Hassan");
    expect(results[0]?.company).toBeUndefined();
  });

  it("rejects job postings, job boards, company pages, and recruitment agencies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          {
            title: "React Developer jobs in Cairo",
            link: "https://example.com/jobs/react-cairo",
            snippet: "Browse React Developer job listings.",
          },
          {
            title: "React Developer - Indeed.com",
            link: "https://www.indeed.com/q-react-developer-jobs.html",
            snippet: "Find React Developer jobs.",
          },
          {
            title: "Nile Software Solutions | LinkedIn",
            link: "https://www.linkedin.com/company/nile-software-solutions",
            snippet: "Nile Software Solutions is a technology company.",
          },
          {
            title: "React Developer Recruitment - Hays",
            link: "https://www.hays.com/jobs/react-developer",
            snippet: "Hays recruitment agency.",
          },
          {
            title: "Amina Hassan - Senior React Developer | LinkedIn",
            link: "https://linkedin.com/in/amina-hassan",
            snippet: "5+ years building React apps.",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "React Developer Cairo" });

    expect(results).toHaveLength(1);
    expect(results[0]?.profile_url).toBe("https://linkedin.com/in/amina-hassan");
  });

  it("keeps individual LinkedIn and GitHub profiles", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          { title: "Amina Hassan | LinkedIn", link: "https://linkedin.com/in/amina-hassan" },
          { title: "amina-hassan (Amina Hassan)", link: "https://github.com/amina-hassan" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "React Developer Cairo" });

    expect(results).toHaveLength(2);
  });

  it("skips results with no link (nothing to point a recruiter to)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [{ title: "No link here", snippet: "..." }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "x" });
    expect(results).toEqual([]);
  });

  it("returns an empty array when there are no organic_results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "x" });
    expect(results).toEqual([]);
  });

  it("throws SearchProviderError when the HTTP response is not ok", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("bad-key");
    await expect(provider.searchCandidates({ query: "x" })).rejects.toThrow(
      SearchProviderError,
    );
  });

  it("throws SearchProviderError when SerpApi returns an error field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: "Invalid API key" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("bad-key");
    await expect(provider.searchCandidates({ query: "x" })).rejects.toThrow(
      SearchProviderError,
    );
  });

  it("returns an empty list when Google has no results for the query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: "Google hasn't returned any results for this query." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    await expect(provider.searchCandidates({ query: "x" })).resolves.toEqual([]);
  });

  it("throws SearchProviderError when the network request itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    await expect(provider.searchCandidates({ query: "x" })).rejects.toThrow(
      SearchProviderError,
    );
  });

  it("retries a 429 and succeeds once the provider recovers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ organic_results: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "x" });

    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 401 (retrying a bad key won't fix it)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("bad-key");
    await expect(provider.searchCandidates({ query: "x" })).rejects.toThrow(
      SearchProviderError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries on a persistent 503", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    await expect(provider.searchCandidates({ query: "x" })).rejects.toThrow(
      SearchProviderError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("passes an AbortSignal so a stalled request can't hang the run forever", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organic_results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    await provider.searchCandidates({ query: "x" });

    const options = fetchMock.mock.calls[0]?.[1];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("treats an aborted/timed-out request as retryable, not a hard failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("The operation was aborted.", "TimeoutError"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ organic_results: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    const results = await provider.searchCandidates({ query: "x" });

    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("includes location, limit, and page in the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organic_results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SerpApiProvider("test-key");
    await provider.searchCandidates({
      query: "React Developer",
      location: "Cairo, Egypt",
      limit: 10,
      page: 2,
    });

    const calledUrl = new URL(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl.searchParams.get("q")).toBe("React Developer");
    expect(calledUrl.searchParams.get("location")).toBe("Cairo, Egypt");
    expect(calledUrl.searchParams.get("num")).toBe("10");
    expect(calledUrl.searchParams.get("start")).toBe("10");
  });
});
