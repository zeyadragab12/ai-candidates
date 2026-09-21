import { env } from "@/lib/env";
import { MockSearchProvider } from "@/lib/search/MockSearchProvider";
import { SerpApiProvider } from "@/lib/search/SerpApiProvider";
import type { SearchProvider } from "@/lib/search/SearchProvider";

let cachedProvider: SearchProvider | null = null;

export function getSearchProvider(): SearchProvider {
  if (!cachedProvider) {
    switch (env.SEARCH_PROVIDER) {
      case "mock":
        cachedProvider = new MockSearchProvider();
        break;
      case "serpapi":
        if (!env.SERPAPI_API_KEY) {
          throw new Error(
            'SEARCH_PROVIDER is set to "serpapi", but SERPAPI_API_KEY is not set. Set it in your environment; this never silently falls back to mock.',
          );
        }
        cachedProvider = new SerpApiProvider(env.SERPAPI_API_KEY);
        break;
      case "serper":
        throw new Error(
          'SEARCH_PROVIDER is set to "serper", but SerperProvider is not implemented yet.',
        );
      default: {
        const exhaustiveCheck: never = env.SEARCH_PROVIDER;
        throw new Error(`Unknown SEARCH_PROVIDER: ${exhaustiveCheck}`);
      }
    }
  }
  return cachedProvider;
}

export type { SearchProvider } from "@/lib/search/SearchProvider";
