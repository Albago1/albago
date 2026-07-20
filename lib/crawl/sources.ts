/**
 * AlbaGo Crawl (master plan CRAWL-1): the curated source registry.
 *
 * Each entry is a PUBLIC web page the crawler is allowed to read — a venue's
 * events page, a promoter's listing, a ticketing page, a culture calendar.
 * The crawler reads only what the page publishes about itself (OpenGraph,
 * schema.org/Event JSON-LD, visible text), exactly as the Lens URL reader
 * already does. It never touches login-walled social platforms.
 *
 * This is a checked-in config for CRAWL-1; CRAWL-2 moves it to a `crawl_sources`
 * DB table with an admin UI so sources can be edited without a deploy.
 *
 * The entries below are DISABLED TEMPLATES. Replace them with real source URLs
 * and flip `enabled: true` once you have confirmed each one loads a public
 * event page in a browser. Until then the registry crawl is a no-op, and you
 * can still test any URL ad-hoc by POSTing `{ sourceUrls: ["..."] }` to
 * /api/admin/crawl.
 */

export type CrawlSourceKind = 'venue' | 'promoter' | 'ticketing' | 'listing'

export type CrawlSource = {
  /** The public page to read. One event per page reads best; a listing page
   *  yields its single most prominent event (the extractor picks one). */
  url: string
  /** Human label shown in the crawl report and (CRAWL-2) the admin UI. */
  label: string
  kind: CrawlSourceKind
  /** Optional hints. The extractor resolves city/country from the page itself;
   *  these are only a fallback for pages that omit them. Currently advisory —
   *  resolution still runs off the reading, not these. */
  city?: string
  country?: string
  /** Disabled sources are skipped by a registry crawl. */
  enabled: boolean
}

export const CRAWL_SOURCES: CrawlSource[] = [
  {
    url: 'https://replace-me.example/venue/events',
    label: 'Template — a venue events page',
    kind: 'venue',
    country: 'Albania',
    enabled: false,
  },
  {
    url: 'https://replace-me.example/promoter/upcoming',
    label: 'Template — a promoter listing',
    kind: 'promoter',
    country: 'Albania',
    enabled: false,
  },
  {
    url: 'https://replace-me.example/tickets/event',
    label: 'Template — a ticketing event page',
    kind: 'ticketing',
    country: 'Albania',
    enabled: false,
  },
]

/** The sources a scheduled/registry crawl will actually visit. */
export function enabledSources(): CrawlSource[] {
  return CRAWL_SOURCES.filter((s) => s.enabled)
}
