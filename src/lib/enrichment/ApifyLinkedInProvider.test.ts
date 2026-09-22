import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApifyLinkedInProvider,
  EnrichmentProviderError,
  extractLinkedInSlug,
} from "./ApifyLinkedInProvider";

describe("extractLinkedInSlug", () => {
  it("extracts the slug regardless of country subdomain, protocol, or trailing slash", () => {
    expect(extractLinkedInSlug("https://eg.linkedin.com/in/amina-hassan/")).toBe("amina-hassan");
    expect(extractLinkedInSlug("https://www.linkedin.com/in/amina-hassan")).toBe("amina-hassan");
    expect(extractLinkedInSlug("http://sa.linkedin.com/in/Amina-Hassan?trk=x")).toBe(
      "amina-hassan",
    );
  });

  it("returns null for a URL with no /in/ segment", () => {
    expect(extractLinkedInSlug("https://linkedin.com/company/nile-software")).toBeNull();
  });
});

describe("ApifyLinkedInProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws immediately if constructed with an empty API token", () => {
    expect(() => new ApifyLinkedInProvider("", "some-actor")).toThrow(
      /APIFY_API_TOKEN is required/,
    );
  });

  it("throws immediately if constructed with an empty actor id", () => {
    expect(() => new ApifyLinkedInProvider("test-token", "")).toThrow(
      /APIFY_ACTOR_ID is required/,
    );
  });

  it("returns an empty map without calling fetch when given no profile URLs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("test-token", "some-actor");
    const result = await provider.enrichProfiles([]);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the profile URLs to the run-sync-get-dataset-items endpoint for the configured actor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("test-token", "harvestapi~linkedin-profile-scraper");
    await provider.enrichProfiles(["https://linkedin.com/in/amina-hassan"]);

    const calledUrl = fetchMock.mock.calls[0]?.[0];
    const options = fetchMock.mock.calls[0]?.[1];
    const parsedUrl = new URL(calledUrl);
    expect(parsedUrl.pathname).toBe(
      "/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items",
    );
    expect(parsedUrl.searchParams.get("token")).toBe("test-token");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body)).toEqual({
      queries: ["https://linkedin.com/in/amina-hassan"],
      profileScraperMode: "Profile details no email ($4 per 1k)",
    });
  });

  it("maps dataset items into enriched profiles keyed by LinkedIn slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          linkedinUrl: "https://www.linkedin.com/in/amina-hassan",
          publicIdentifier: "amina-hassan",
          firstName: "Amina",
          lastName: "Hassan",
          headline: "Senior React Developer",
          currentPosition: [{ companyName: "Nile Software Solutions" }],
          location: { linkedinText: "Cairo, Egypt" },
          about: "React specialist with a focus on performance.",
          skills: [{ name: "React" }, { name: "TypeScript" }, { name: "" }],
          experience: [{ duration: "2 yrs 6 mos" }, { duration: "1 yr 6 mos" }],
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("test-token", "some-actor");
    const result = await provider.enrichProfiles(["https://eg.linkedin.com/in/amina-hassan"]);

    expect(result.get("amina-hassan")).toEqual({
      profileUrl: "https://www.linkedin.com/in/amina-hassan",
      name: "Amina Hassan",
      headline: "Senior React Developer",
      currentCompany: "Nile Software Solutions",
      location: "Cairo, Egypt",
      about: "React specialist with a focus on performance.",
      skills: ["React", "TypeScript"],
      experienceYears: 4,
    });
  });

  it("skips dataset items with no resolvable profile URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ firstName: "No URL Here" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("test-token", "some-actor");
    const result = await provider.enrichProfiles(["https://linkedin.com/in/amina-hassan"]);

    expect(result.size).toBe(0);
  });

  it("leaves experienceYears undefined when the actor returns no experience entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { linkedinUrl: "https://www.linkedin.com/in/amina-hassan", publicIdentifier: "amina-hassan" },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("test-token", "some-actor");
    const result = await provider.enrichProfiles(["https://linkedin.com/in/amina-hassan"]);

    expect(result.get("amina-hassan")?.experienceYears).toBeUndefined();
  });

  it("throws EnrichmentProviderError when the HTTP response is not ok", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("bad-token", "some-actor");
    await expect(
      provider.enrichProfiles(["https://linkedin.com/in/amina-hassan"]),
    ).rejects.toThrow(EnrichmentProviderError);
  });

  it("throws EnrichmentProviderError when the network request itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("test-token", "some-actor");
    await expect(
      provider.enrichProfiles(["https://linkedin.com/in/amina-hassan"]),
    ).rejects.toThrow(EnrichmentProviderError);
  });

  it("retries a 429 and succeeds once the provider recovers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("test-token", "some-actor");
    const result = await provider.enrichProfiles(["https://linkedin.com/in/amina-hassan"]);

    expect(result.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 401 (retrying a bad token won't fix it)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApifyLinkedInProvider("bad-token", "some-actor");
    await expect(
      provider.enrichProfiles(["https://linkedin.com/in/amina-hassan"]),
    ).rejects.toThrow(EnrichmentProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
