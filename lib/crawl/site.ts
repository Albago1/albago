import { safeFetch } from '@/lib/ssrfGuard'
import { filterEventUrl, discoverEventLinks, MAX_DISCOVERED_LINKS } from '@/lib/crawl/discover'

/**
 * AlbaGo Crawl (master plan CRAWL-1.6): site mode.
 *
 * Give it just a domain (https://venue.al) and it finds the event pages itself
 * — no need to hand it the right "/events" URL. It reads the site's own
 * machine-readable index (sitemap, located via robots.txt or the conventional
 * /sitemap.xml), keeps the same-host, event-looking URLs, and hands them to the
 * normal pipeline. When a site publishes no usable sitemap, it falls back to
 * discovering event links on the homepage.
 *
 * Stays a polite reader: same-host only, bounded sitemap fan-out, capped output,
 * SSRF-guarded fetches. It reads the site's own published index — the standard,
 * intended way to enumerate a site — never a blind web spider.
 */

const FETCH_TIMEOUT_MS = 8000
const MAX_SITEMAP_BYTES = 3_000_000
// A sitemap index points at child sitemaps; bound how many we follow.
const MAX_CHILD_SITEMAPS = 6

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

export type SiteDiscovery = {
  /** Event-detail URLs to read. */
  eventUrls: string[]
  /** How they were found — useful in the crawl report. */
  via: 'sitemap' | 'homepage' | 'none'
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(url, { headers: BROWSER_HEADERS, timeoutMs: FETCH_TIMEOUT_MS })
    if (!res.ok) return null
    return (await res.text()).slice(0, MAX_SITEMAP_BYTES)
  } catch {
    return null
  }
}

/** Sitemap URLs declared in robots.txt (`Sitemap: <url>` lines). */
async function sitemapsFromRobots(origin: string): Promise<string[]> {
  const txt = await fetchText(new URL('/robots.txt', origin).toString())
  if (!txt) return []
  const out: string[] = []
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*sitemap:\s*(\S+)/i)
    if (m) out.push(m[1].trim())
  }
  return out
}

/** All <loc> values in a sitemap or sitemap-index document. */
function extractLocs(xml: string): string[] {
  const out: string[] = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1].trim())
  return out
}

function isSitemapDoc(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml)
}

/**
 * Collect candidate event URLs from a site's sitemap(s). Handles a sitemap
 * index (fan out to bounded child sitemaps) and a plain urlset. Filters to
 * same-host, event-looking pages via the shared discover rule.
 */
async function eventUrlsFromSitemaps(
  origin: string,
  sitemapUrls: string[],
): Promise<string[]> {
  const kept = new Set<string>()
  const queue = [...sitemapUrls]
  let childBudget = MAX_CHILD_SITEMAPS

  while (queue.length && kept.size < MAX_DISCOVERED_LINKS) {
    const sm = queue.shift()!
    const xml = await fetchText(sm)
    if (!xml) continue

    if (isSitemapDoc(xml)) {
      // A sitemap index — enqueue child sitemaps, preferring event-ish ones.
      const children = extractLocs(xml)
      const prioritized = [
        ...children.filter((c) => /event|ngjarje|agenda|program|calendar|kalendar/i.test(c)),
        ...children,
      ]
      for (const child of prioritized) {
        if (childBudget <= 0) break
        if (!queue.includes(child)) {
          queue.push(child)
          childBudget--
        }
      }
      continue
    }

    // A urlset — keep the event-looking page URLs.
    for (const loc of extractLocs(xml)) {
      const url = filterEventUrl(loc, origin)
      if (url) kept.add(url)
      if (kept.size >= MAX_DISCOVERED_LINKS) break
    }
  }

  return Array.from(kept).slice(0, MAX_DISCOVERED_LINKS)
}

/**
 * Discover event URLs for a whole site from just its domain. Tries the
 * sitemap (robots.txt-declared, then conventional locations); falls back to
 * homepage link discovery. Best-effort — returns { via: 'none' } if nothing
 * usable is found, never throws.
 */
export async function discoverFromSite(siteUrl: string): Promise<SiteDiscovery> {
  let origin: string
  try {
    origin = new URL(siteUrl).origin
  } catch {
    return { eventUrls: [], via: 'none' }
  }

  const declared = await sitemapsFromRobots(origin)
  const candidates =
    declared.length > 0
      ? declared
      : [
          new URL('/sitemap.xml', origin).toString(),
          new URL('/sitemap_index.xml', origin).toString(),
          new URL('/sitemap-index.xml', origin).toString(),
        ]

  const fromSitemap = await eventUrlsFromSitemaps(origin, candidates)
  if (fromSitemap.length > 0) {
    return { eventUrls: fromSitemap, via: 'sitemap' }
  }

  // No usable sitemap — fall back to reading the homepage as a listing page.
  const fromHome = await discoverEventLinks(siteUrl)
  if (fromHome.length > 0) {
    return { eventUrls: fromHome, via: 'homepage' }
  }

  return { eventUrls: [], via: 'none' }
}
