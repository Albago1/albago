import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPublicHttpUrl } from '@/lib/ssrfGuard'
import { crawlSources } from '@/lib/crawl/crawl'

/**
 * AlbaGo Crawl (master plan CRAWL-1): admin-triggered event crawl.
 *
 * POST { dryRun?, sourceUrls?, listingUrls?, siteUrls?, maxEventsPerListing? }
 *   - dryRun (default TRUE): classify each event and return the would-be
 *     submission WITHOUT writing anything.
 *   - dryRun:false: insert each passing find as a `pending` event_submission
 *     for review in /admin/queue (fully reversible via the existing reject).
 *   - sourceUrls: single event pages, read one event each.
 *   - listingUrls: index/listing pages — the crawler discovers the event links
 *     on each and reads them all (the "search over a page of events" mode).
 *   - siteUrls: just a domain — the crawler reads the site's sitemap (or
 *     homepage) to find its event pages itself (site mode).
 *   - pastedText: a block of text (e.g. an events list copied from ChatGPT) —
 *     every event in it is extracted, no fetching. Sidesteps JS-walled sites.
 *   - all omitted: crawl the enabled entries in lib/crawl/sources.ts.
 *
 * Built for HUGE lists: a single call runs within a time budget and returns
 * `report.remaining` (grouped by mode) with whatever it didn't reach. Feed
 * `remaining` back in to continue — the `scripts/crawl-batch.mjs` driver loops
 * this automatically over a list of any size.
 *
 * Auth: an authenticated admin session OR a bearer token equal to CRAWL_SECRET
 * (so a headless driver / future cron can call it). Reads only public pages via
 * the Lens URL reader (SSRF-guarded); the response carries no user-facing
 * strings, so no i18n is involved.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Big lists are expected; the time budget (not this cap) is what bounds a call.
// Anything past the deadline returns in report.remaining to be continued.
const MAX_URLS_PER_REQUEST = 500

/** Bearer token matches the configured CRAWL_SECRET (constant-time-ish). */
function hasValidToken(request: Request): boolean {
  const secret = process.env.CRAWL_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return token.length > 0 && token === secret
}

async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    return (profile as { role?: string | null } | null)?.role === 'admin'
  } catch {
    return false
  }
}

type Body = {
  dryRun?: unknown
  sourceUrls?: unknown
  listingUrls?: unknown
  siteUrls?: unknown
  pastedText?: unknown
  maxEventsPerListing?: unknown
}

const MAX_PASTED_CHARS = 40_000

/** Validate a raw URL array into public http(s) URLs (structural SSRF check).
 *  Returns null when the field is present but not an array. */
function cleanUrlList(raw: unknown): string[] | null | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return null
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const ok = isPublicHttpUrl(item.trim())
    if (ok) out.push(ok.toString())
  }
  return out.slice(0, MAX_URLS_PER_REQUEST)
}

/**
 * Health / usage probe. This endpoint does its real work over POST, so a browser
 * visit (a GET) would otherwise look "broken" — this returns a friendly note
 * confirming it is deployed and how to call it. No auth, no side effects, no
 * secrets: it never crawls and never reveals whether CRAWL_SECRET is set.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'albago-crawl',
    note: 'This endpoint runs over POST, not GET — a browser visit cannot trigger a crawl. Send a POST request (see modes).',
    modes: {
      sourceUrls: 'array of single event pages',
      listingUrls: 'array of listing/index pages (all events on each)',
      siteUrls: 'array of bare domains (events discovered via sitemap/homepage)',
      pastedText: 'a text blob (e.g. events copied from ChatGPT) — no fetching',
    },
    dryRunDefault: true,
    auth: 'admin session, or Authorization: Bearer <CRAWL_SECRET>',
  })
}

export async function POST(request: Request) {
  // 1. Caller must be an admin session OR present the CRAWL_SECRET bearer token.
  if (!hasValidToken(request) && !(await isAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 2. Parse + validate the payload.
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    // An empty body is valid — defaults to a dry run of the enabled registry.
    body = {}
  }

  // Default to a dry run: writing to the queue must be an explicit choice.
  const dryRun = body.dryRun === false ? false : true

  const urls = cleanUrlList(body.sourceUrls)
  if (urls === null) {
    return NextResponse.json({ error: 'sourceUrls_must_be_array' }, { status: 400 })
  }
  const listingUrls = cleanUrlList(body.listingUrls)
  if (listingUrls === null) {
    return NextResponse.json({ error: 'listingUrls_must_be_array' }, { status: 400 })
  }
  const siteUrls = cleanUrlList(body.siteUrls)
  if (siteUrls === null) {
    return NextResponse.json({ error: 'siteUrls_must_be_array' }, { status: 400 })
  }

  const pastedText =
    typeof body.pastedText === 'string' && body.pastedText.trim()
      ? body.pastedText.slice(0, MAX_PASTED_CHARS)
      : undefined

  // If the caller named URL fields but none survived validation — and there's no
  // pasted text either — say so rather than silently falling back to the registry.
  if (
    (body.sourceUrls !== undefined ||
      body.listingUrls !== undefined ||
      body.siteUrls !== undefined) &&
    !urls?.length &&
    !listingUrls?.length &&
    !siteUrls?.length &&
    !pastedText
  ) {
    return NextResponse.json({ error: 'no_valid_urls' }, { status: 400 })
  }

  const maxEventsPerListing =
    typeof body.maxEventsPerListing === 'number' && body.maxEventsPerListing > 0
      ? Math.floor(body.maxEventsPerListing)
      : undefined

  // 3. Run the crawl.
  try {
    const report = await crawlSources({
      dryRun,
      urls,
      listingUrls,
      siteUrls,
      pastedText,
      maxEventsPerListing,
    })
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[admin/crawl] run failed:', err)
    return NextResponse.json({ ok: false, error: 'crawl_failed' }, { status: 500 })
  }
}
