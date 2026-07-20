import { safeFetch } from '@/lib/ssrfGuard'

/**
 * AlbaGo Crawl (master plan CRAWL-1.5): event-link discovery.
 *
 * Given a public listing / index page (a venue's "upcoming events", a promoter
 * feed, a ticketing catalog, a city culture calendar), find the individual
 * event pages linked from it — so the crawler can go over a whole page of
 * events instead of one. Each discovered link is then read by the normal Lens
 * pipeline, and the extractor's own is_event / confidence gate throws out
 * anything that turns out not to be an event.
 *
 * Bounds that keep this a well-behaved reader, not a spider:
 *   - Same-host only. We follow event links on the page you point at, never
 *     wander off to sponsors, social buttons, or the wider web.
 *   - Event-looking only. A URL/anchor must carry an event signal (an event-ish
 *     path/word in en+sq+de+es+it, a date, or a structured-data Event url).
 *   - Capped. At most MAX_DISCOVERED_LINKS candidates per listing.
 *   - SSRF-guarded. The fetch goes through safeFetch (private-range + redirect
 *     re-validation), exactly like the Lens URL reader.
 */

const MAX_HTML_BYTES = 800_000
const FETCH_TIMEOUT_MS = 8000
export const MAX_DISCOVERED_LINKS = 15

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en,sq;q=0.9,de;q=0.8,es;q=0.7',
}

// Path/text tokens that mark an event detail link, across the languages the
// catalog targets. Matched as substrings, so "event-detail", "ngjarje", etc.
const EVENT_TOKENS = [
  'event',
  'events',
  'ngjarje', // sq: event(s)
  'aktivitet', // sq: activity
  'spektakel', // sq: show
  'koncert',
  'concert',
  'party',
  'festa',
  'festival',
  'show',
  'ticket',
  'tickets',
  'bileta', // sq: tickets
  'veranstaltung', // de: event
  'evento', // es/it: event
  'agenda',
  'programm',
  'program',
  'kalendar',
  'calendar',
  'whats-on',
  'whatson',
  '/e/',
]

// Hosts that are never the event source (share/social/util links on the page).
const SKIP_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'twitter.com',
  'x.com',
  't.co',
  'tiktok.com',
  'www.tiktok.com',
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'linkedin.com',
  'www.linkedin.com',
  'pinterest.com',
  'wa.me',
  'api.whatsapp.com',
  't.me',
])

// Path fragments that mark non-event pages (nav, account, taxonomy, legal).
const SKIP_PATH_FRAGMENTS = [
  '/tag/',
  '/tags/',
  '/category/',
  '/categories/',
  '/cat/',
  '/author/',
  '/page/',
  '/wp-',
  '/login',
  '/signin',
  '/sign-in',
  '/register',
  '/cart',
  '/checkout',
  '/account',
  '/profile',
  '/privacy',
  '/terms',
  '/contact',
  '/about',
  '/faq',
  '/search',
  '/feed',
  '/rss',
]

const DATE_IN_URL = /(?:^|[/_-])20\d{2}(?:[/_-]\d{1,2}){1,2}/

function hasEventToken(value: string): boolean {
  const v = value.toLowerCase()
  return EVENT_TOKENS.some((t) => v.includes(t))
}

/**
 * The shared keep-rule for a candidate event URL, used by both in-page anchor
 * discovery and sitemap (site-mode) discovery. Returns a normalized absolute
 * URL string to keep, or null to drop. Enforces: valid http(s), same host as
 * base, not a social/nav/legal link, and carries an event signal (event-ish
 * path/word, a date in the URL, or an explicit textSignal from anchor text).
 */
export function filterEventUrl(
  candidate: string,
  baseUrl: string,
  opts: { textSignal?: boolean } = {},
): string | null {
  const base = new URL(baseUrl)
  let u: URL
  try {
    u = new URL(candidate, base)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.host !== base.host) return null // same-host only
  if (SKIP_HOSTS.has(u.host)) return null
  const path = u.pathname.toLowerCase()
  if (SKIP_PATH_FRAGMENTS.some((f) => path.includes(f))) return null
  if (path === '/' || path === base.pathname.toLowerCase()) return null
  if (!hasEventToken(path) && !DATE_IN_URL.test(path) && !opts.textSignal) return null
  u.hash = ''
  return u.toString().replace(/\/$/, '')
}

/** Strip tags/entities from an anchor's inner HTML to get its visible text. */
function anchorText(inner: string): string {
  return inner
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * Pull candidate event-detail URLs out of already-fetched HTML. Pure (no
 * network) and exported so it can be unit-tested against fixture HTML.
 */
export function extractEventLinks(html: string, baseUrl: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  const add = (candidate: string, textSignal = false) => {
    if (out.length >= MAX_DISCOVERED_LINKS) return
    const kept = filterEventUrl(candidate, baseUrl, { textSignal })
    if (!kept || seen.has(kept)) return
    seen.add(kept)
    out.push(kept)
  }

  // 1. Structured data: schema.org Event/ItemList urls are the cleanest signal.
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let ld: RegExpExecArray | null
  while ((ld = ldRe.exec(html)) && out.length < MAX_DISCOVERED_LINKS) {
    const urlRe = /"url"\s*:\s*"([^"]+)"/g
    let m: RegExpExecArray | null
    const block = ld[1]
    const isEventBlock = /"@type"\s*:\s*"[^"]*(?:Event|ItemList)/i.test(block)
    if (!isEventBlock) continue
    while ((m = urlRe.exec(block)) && out.length < MAX_DISCOVERED_LINKS) {
      add(m[1], true) // JSON-LD event urls are trusted signal
    }
  }

  // 2. Anchors: href + visible text.
  const aRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let a: RegExpExecArray | null
  while ((a = aRe.exec(html)) && out.length < MAX_DISCOVERED_LINKS) {
    const href = a[1]
    if (href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) continue
    const text = anchorText(a[2])
    add(href, hasEventToken(text))
  }

  return out
}

/**
 * Fetch a listing page and return the event-detail URLs found on it (bounded,
 * same-host, deduped). Returns [] on any fetch/parse failure — discovery is
 * best-effort and never throws into the crawl batch.
 */
export async function discoverEventLinks(listingUrl: string): Promise<string[]> {
  try {
    const res = await safeFetch(listingUrl, {
      headers: BROWSER_HEADERS,
      timeoutMs: FETCH_TIMEOUT_MS,
    })
    if (!res.ok) return []
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('html') && !contentType.includes('xml')) return []
    const html = (await res.text()).slice(0, MAX_HTML_BYTES)
    return extractEventLinks(html, res.url || listingUrl)
  } catch {
    return []
  }
}
