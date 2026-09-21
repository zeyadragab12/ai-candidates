import type { SearchProvider } from "@/lib/search/SearchProvider";
import type { CandidateSearchParams, CandidateSearchResult } from "@/types/search";

/**
 * Deterministic fixture data for local development and demos. Deliberately
 * includes candidates with missing optional fields (no company, no
 * location, no skills, etc.) so downstream normalization/dedupe/UI code is
 * forced to handle nulls rather than assuming every field is present.
 */
const FIXTURE_CANDIDATES: CandidateSearchResult[] = [
  {
    source: "mock",
    source_url: "https://example.com/search?q=react-developer",
    name: "Amina Hassan",
    title: "Senior React Developer",
    company: "Nile Software Solutions",
    location: "Cairo, Egypt",
    profile_url: "https://example.com/in/amina-hassan",
    snippet: "5+ years building React and TypeScript applications.",
    skills: ["React", "TypeScript", "Next.js"],
  },
  {
    source: "mock",
    source_url: "https://example.com/search?q=react-developer",
    name: "Omar El-Sayed",
    title: "Frontend Engineer",
    location: "Giza, Egypt",
    profile_url: "https://example.com/in/omar-elsayed",
    skills: ["React", "JavaScript"],
    // company deliberately omitted
  },
  {
    source: "mock",
    source_url: "https://example.com/search?q=react-developer",
    name: "Sara Youssef",
    title: "React Developer",
    company: "Delta Digital",
    profile_url: "https://example.com/in/sara-youssef",
    snippet: "Frontend specialist with a focus on performance.",
    // location deliberately omitted
  },
  {
    source: "mock",
    source_url: "https://example.com/search?q=react-developer",
    name: "Karim Mostafa",
    company: "Alexandria Tech",
    location: "Alexandria, Egypt",
    profile_url: "https://example.com/in/karim-mostafa",
    // title and skills deliberately omitted
  },
  {
    source: "mock",
    source_url: "https://example.com/search?q=react-developer",
    name: "Nour Adel",
    title: "Full Stack Developer",
    company: "Cairo Labs",
    location: "Cairo, Egypt",
    skills: ["React", "Node.js", "PostgreSQL"],
    // profile_url and snippet deliberately omitted
  },
  {
    source: "mock",
    source_url: "https://example.com/search?q=react-developer",
    name: "Yasmin Fathy",
    snippet: "Frontend developer profile found via public search.",
    // title, company, location, profile_url, skills all omitted
  },
  {
    source: "mock",
    source_url: "https://example.com/search?q=react-developer",
    title: "React Developer",
    company: "Anonymous Corp",
    location: "Remote",
    // name deliberately omitted (source didn't expose it)
  },
  {
    source: "mock",
    source_url: "https://example.com/search?q=react-developer",
    name: "Hana Ibrahim",
    title: "Senior Frontend Engineer",
    company: "Red Sea Apps",
    location: "Hurghada, Egypt",
    profile_url: "https://example.com/in/hana-ibrahim",
    snippet: "8 years of experience across React, Vue, and Angular.",
    skills: ["React", "Vue", "Angular", "TypeScript"],
  },
];

export class MockSearchProvider implements SearchProvider {
  async searchCandidates(
    params: CandidateSearchParams,
  ): Promise<CandidateSearchResult[]> {
    const page = params.page ?? 1;
    const limit = params.limit ?? FIXTURE_CANDIDATES.length;

    if (page > 1) {
      return [];
    }

    return FIXTURE_CANDIDATES.slice(0, limit);
  }
}
