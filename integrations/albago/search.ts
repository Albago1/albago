import type { SearchProvider } from '@/engine'

/**
 * SearchProvider over Tavily (free "Researcher" plan: 1,000 credits/month, no
 * card). A basic search costs 1 credit. Swappable: any provider returning
 * {url, title, snippet} satisfies the engine.
 */
export function tavilySearch(apiKey: string): SearchProvider {
  return {
    id: 'tavily',
    async search(query, { maxResults, recencyDays }) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          query,
          max_results: Math.min(Math.max(maxResults, 1), 10),
          search_depth: 'basic',
          include_answer: false,
          ...(recencyDays ? { days: recencyDays } : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new Error(`tavily ${res.status}`)
      const body = (await res.json()) as { results?: { url: string; title?: string; content?: string; published_date?: string }[] }
      return (body.results ?? []).map((r) => ({
        url: r.url,
        title: r.title ?? r.url,
        snippet: r.content ?? '',
        published: r.published_date ?? null,
      }))
    },
  }
}
