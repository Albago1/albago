import type { SupabaseClient } from '@supabase/supabase-js'
import { readEventFromUrl, readEventListFromUrl } from '@/lib/ai/urlReader'
import { resolvePoster, type LensResolution } from '@/lib/lens/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { crawlReadingToSubmission, type CrawlSubmission } from '@/lib/crawl/toSubmission'
import type { PosterReading } from '@/lib/ai/posterReader'
import { enabledSources, type CrawlSource } from '@/lib/crawl/sources'
import { discoverEventLinks, MAX_DISCOVERED_LINKS } from '@/lib/crawl/discover'
import { discoverFromSite } from '@/lib/crawl/site'

/**
 * AlbaGo Crawl (master plan CRAWL-1): the orchestration layer that turns a
 * curated public URL into a pending moderation-queue submission, reusing the
 * Lens extraction + resolution engine end-to-end.
 *
 * Every find is proposed, never published. Dry run (the default) classifies and
 * returns the would-be payload without writing; live mode inserts a `pending`
 * row via the service client for an admin to approve.
 */

// Autonomous finds get a slightly higher bar than a human paste (0.3 in the URL
// route) — an unattended pipeline should be conservative about what it queues.
const CRAWL_MIN_CONFIDENCE = 0.35

// Politeness between fetches in a registry crawl (ms). One host at a time.
const POLITE_DELAY_MS = 800

// Default cap on how many discovered events to read per listing page. Keeps a
// single request inside the serverless time budget (~4s per event read).
const DEFAULT_MAX_EVENTS_PER_LISTING = 8

// Wall-clock budget for one crawlSources call. The route's maxDuration is 60s;
// we stop STARTING new inputs at 45s so an in-flight input can finish and the
// response can serialize. Whatever's left comes back in report.remaining so a
// huge list continues across calls instead of timing out.
const DEFAULT_DEADLINE_MS = 45_000

export type CrawlOutcome =
  | 'would_submit' // dry run: passed every gate, ready to queue
  | 'submitted' // live: inserted as a pending submission
  | 'duplicate_live' // already published on AlbaGo — skipped
  | 'duplicate_in_review' // already pending in the queue — skipped
  | 'not_an_event' // page isn't a single event, or confidence too low
  | 'unreadable' // fetch blocked / login-walled / no event signal
  | 'error' // unexpected failure on this URL (others still run)

export type CrawlItemResult = {
  url: string
  label?: string
  /** The listing page this event was discovered on, when it came from one. */
  discoveredFrom?: string
  outcome: CrawlOutcome
  /** Present for would_submit / submitted / duplicate_* : the reading summary. */
  title?: string
  confidence?: number
  /** Resolution summary, present once extraction succeeded. */
  resolution?: {
    city: string
    cityStatus: LensResolution['city']['status']
    venueStatus: LensResolution['venue']['status']
    duplicate: LensResolution['duplicate']['status']
  }
  /** The would-be / inserted submission payload (dry run always includes it). */
  submission?: CrawlSubmission
  /** Inserted row id (live mode, submitted only). */
  submissionId?: string
  /** Human-readable note for error/unreadable outcomes. */
  note?: string
}

/** Inputs not reached before the time budget ran out, grouped by mode so they
 *  can be passed straight back into another crawlSources call to continue. */
export type CrawlRemaining = {
  sourceUrls?: string[]
  listingUrls?: string[]
  siteUrls?: string[]
}

export type CrawlReport = {
  dryRun: boolean
  ranAt: string
  counts: Record<CrawlOutcome, number>
  items: CrawlItemResult[]
  /** How many inputs (single pages + listings + sites) this run was given. */
  totalInputs: number
  /** Inputs processed before the deadline. `remaining` covers the rest. */
  processedInputs: number
  /** Present only when the run stopped early on its time budget with work left.
   *  Feed it back in verbatim to continue the huge list where it paused. */
  remaining?: CrawlRemaining
}

function emptyCounts(): Record<CrawlOutcome, number> {
  return {
    would_submit: 0,
    submitted: 0,
    duplicate_live: 0,
    duplicate_in_review: 0,
    not_an_event: 0,
    unreadable: 0,
    error: 0,
  }
}

function resolutionSummary(reading: PosterReading, resolution: LensResolution) {
  return {
    city: resolution.city.label || reading.city || '',
    cityStatus: resolution.city.status,
    venueStatus: resolution.venue.status,
    duplicate: resolution.duplicate.status,
  }
}

/**
 * Insert a crawler find as a pending submission via the service client. Bypasses
 * RLS deliberately — the crawler is a trusted server process with no auth user,
 * and null-submitter pending rows are exactly the frozen-table shape schema
 * rule #8 permits. Returns the new row id, or null on failure (never throws into
 * the batch — one bad insert must not abort the run).
 */
async function insertSubmission(submission: CrawlSubmission): Promise<string | null> {
  try {
    const admin: SupabaseClient = createAdminClient()
    const { data, error } = await admin
      .from('event_submissions')
      .insert(submission)
      .select('id')
      .single()
    if (error) {
      console.error('[crawl] insert failed:', error.code ?? '', error.message)
      return null
    }
    return (data as { id: string }).id
  } catch (err) {
    console.error('[crawl] insert threw:', err)
    return null
  }
}

type CrawlBase = { url: string; label?: string; discoveredFrom?: string }

/**
 * Resolve + de-dupe + (dry-run or insert) ONE already-extracted reading into a
 * result. Shared by single-page reads and multi-event list reads so both paths
 * classify identically.
 */
async function classifyReading(
  reading: PosterReading,
  base: CrawlBase,
  dryRun: boolean,
): Promise<CrawlItemResult> {
  if (!reading.is_event || !reading.title || reading.confidence < CRAWL_MIN_CONFIDENCE) {
    return { ...base, outcome: 'not_an_event', title: reading.title || undefined, confidence: reading.confidence }
  }

  // Resolve city/venue/coords + dedup. resolvePoster self-degrades on error, so
  // a resolver hiccup yields a still-usable (if unresolved) submission.
  let resolution: LensResolution
  try {
    resolution = await resolvePoster(reading)
  } catch (err) {
    return { ...base, outcome: 'error', title: reading.title, note: err instanceof Error ? err.message : 'resolve_failed' }
  }

  const shared = {
    ...base,
    title: reading.title,
    confidence: reading.confidence,
    resolution: resolutionSummary(reading, resolution),
  }

  // Already on AlbaGo (published) or already pending — the queue is the dedup
  // authority; don't propose it again.
  if (resolution.duplicate.status === 'live') return { ...shared, outcome: 'duplicate_live' }
  if (resolution.duplicate.status === 'in_review') return { ...shared, outcome: 'duplicate_in_review' }

  const submission = crawlReadingToSubmission(reading, resolution)

  if (dryRun) {
    return { ...shared, outcome: 'would_submit', submission }
  }

  const submissionId = await insertSubmission(submission)
  if (!submissionId) {
    return { ...shared, outcome: 'error', submission, note: 'insert_failed' }
  }
  return { ...shared, outcome: 'submitted', submission, submissionId }
}

/**
 * Read one public URL as a SINGLE event and classify it. In a dry run nothing
 * is written; in live mode a passing find is inserted as pending.
 */
export async function crawlUrl(
  url: string,
  opts: { dryRun: boolean; label?: string; discoveredFrom?: string } = { dryRun: true },
): Promise<CrawlItemResult> {
  const base = { url, label: opts.label, discoveredFrom: opts.discoveredFrom }
  const todayIso = new Date().toISOString().slice(0, 10)

  let read: Awaited<ReturnType<typeof readEventFromUrl>>
  try {
    read = await readEventFromUrl(url, todayIso)
  } catch (err) {
    return { ...base, outcome: 'error', note: err instanceof Error ? err.message : 'read_failed' }
  }
  // Fetch blocked / login-walled / JS-only / no event signal on the page.
  if (!read) return { ...base, outcome: 'unreadable' }

  return classifyReading(read.reading, base, opts.dryRun)
}

/**
 * Read one page as a LIST of events (the "paste a page, get all its events"
 * path) and classify each. Returns null when the page can't be fetched at all;
 * an empty array means fetched but no events were found on it.
 */
async function crawlPageAsList(
  url: string,
  opts: { dryRun: boolean; discoveredFrom?: string; maxEvents: number },
): Promise<CrawlItemResult[] | null> {
  const todayIso = new Date().toISOString().slice(0, 10)

  let listed: Awaited<ReturnType<typeof readEventListFromUrl>>
  try {
    listed = await readEventListFromUrl(url, todayIso, opts.maxEvents)
  } catch {
    return null
  }
  if (!listed) return null

  const results: CrawlItemResult[] = []
  for (let i = 0; i < listed.readings.length; i++) {
    const base: CrawlBase = { url, discoveredFrom: opts.discoveredFrom }
    results.push(await classifyReading(listed.readings[i], base, opts.dryRun))
    if (i < listed.readings.length - 1) await wait(POLITE_DELAY_MS)
  }
  return results
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Did a batch of results actually surface any usable event? */
function hasUsableEvent(results: CrawlItemResult[]): boolean {
  return results.some((r) => r.outcome !== 'not_an_event' && r.outcome !== 'unreadable' && r.outcome !== 'error')
}

/**
 * Crawl a LISTING page. Primary path: read the page as a list and extract every
 * event on it (a "what's on" page usually names them all inline). Fallbacks, in
 * order: follow event links to detail pages and read each; finally a single-page
 * read so the page is never silently dropped.
 */
async function crawlListing(
  url: string,
  opts: { dryRun: boolean; maxEvents: number },
): Promise<CrawlItemResult[]> {
  const listed = await crawlPageAsList(url, { dryRun: opts.dryRun, maxEvents: opts.maxEvents })
  if (listed && hasUsableEvent(listed)) return listed

  // Nothing inline — the page may be an index of links to detail pages.
  const links = await discoverEventLinks(url)
  if (links.length > 0) {
    const results: CrawlItemResult[] = []
    const slice = links.slice(0, opts.maxEvents)
    for (let i = 0; i < slice.length; i++) {
      results.push(await crawlUrl(slice[i], { dryRun: opts.dryRun, discoveredFrom: url }))
      if (i < slice.length - 1) await wait(POLITE_DELAY_MS)
    }
    if (hasUsableEvent(results)) return results
  }

  if (listed && listed.length > 0) return listed
  return [await crawlUrl(url, { dryRun: opts.dryRun })]
}

/**
 * Crawl a whole SITE from just its domain. Reads the homepage as a listing
 * first (list extraction + link fallback); if that yields nothing usable, falls
 * back to the site's sitemap event pages (single reads).
 */
async function crawlSite(
  url: string,
  opts: { dryRun: boolean; maxEvents: number },
): Promise<CrawlItemResult[]> {
  const viaHome = await crawlListing(url, opts)
  if (hasUsableEvent(viaHome)) return viaHome

  const { eventUrls } = await discoverFromSite(url)
  if (eventUrls.length > 0) {
    const results: CrawlItemResult[] = []
    const slice = eventUrls.slice(0, opts.maxEvents)
    for (let i = 0; i < slice.length; i++) {
      results.push(await crawlUrl(slice[i], { dryRun: opts.dryRun, discoveredFrom: url }))
      if (i < slice.length - 1) await wait(POLITE_DELAY_MS)
    }
    if (hasUsableEvent(results)) return results
  }

  return viaHome
}

/** A single crawl input before expansion. `site`/`listing` fan out into many
 *  event tasks; `single` is one event page. Kept as a typed unit so leftovers
 *  can be grouped back into a `CrawlRemaining` when the deadline hits. */
type CrawlInput =
  | { kind: 'single'; url: string; label?: string }
  | { kind: 'listing'; url: string }
  | { kind: 'site'; url: string }

/** Run one input to a set of per-event results (list-aware). */
async function processInput(
  input: CrawlInput,
  opts: { dryRun: boolean; maxEvents: number },
): Promise<CrawlItemResult[]> {
  if (input.kind === 'single') {
    return [await crawlUrl(input.url, { dryRun: opts.dryRun, label: input.label })]
  }
  if (input.kind === 'listing') return crawlListing(input.url, opts)
  return crawlSite(input.url, opts)
}

/** Build the ordered input list from the request (or the enabled registry). */
function buildInputs(opts: {
  urls?: string[]
  listingUrls?: string[]
  siteUrls?: string[]
}): CrawlInput[] {
  const inputs: CrawlInput[] = []
  for (const url of opts.urls ?? []) inputs.push({ kind: 'single', url })
  for (const url of opts.listingUrls ?? []) inputs.push({ kind: 'listing', url })
  for (const url of opts.siteUrls ?? []) inputs.push({ kind: 'site', url })
  if (inputs.length === 0) {
    for (const s of enabledSources() as CrawlSource[]) {
      inputs.push({ kind: 'single', url: s.url, label: s.label })
    }
  }
  return inputs
}

/** Group unprocessed inputs back into the request-shaped remaining object. */
function groupRemaining(inputs: CrawlInput[]): CrawlRemaining {
  const remaining: CrawlRemaining = {}
  for (const input of inputs) {
    const key =
      input.kind === 'single' ? 'sourceUrls' : input.kind === 'listing' ? 'listingUrls' : 'siteUrls'
    ;(remaining[key] ??= []).push(input.url)
  }
  return remaining
}

/**
 * Crawl a batch of inputs — single-event `urls`, discover-and-crawl
 * `listingUrls`, whole-site `siteUrls`, or the enabled registry when all are
 * omitted — sequentially and politely, within a wall-clock time budget.
 *
 * Designed for HUGE lists: it processes inputs until the deadline, then returns
 * `report.remaining` with everything it didn't reach, grouped by mode. Pass
 * `remaining` straight back into another call (the driver script loops on it)
 * to work through a list of any size across many bounded requests. One URL
 * failing never aborts the batch.
 */
export async function crawlSources(opts: {
  dryRun: boolean
  urls?: string[]
  listingUrls?: string[]
  siteUrls?: string[]
  maxEventsPerListing?: number
  deadlineMs?: number
}): Promise<CrawlReport> {
  const maxEvents = Math.min(
    opts.maxEventsPerListing ?? DEFAULT_MAX_EVENTS_PER_LISTING,
    MAX_DISCOVERED_LINKS,
  )
  const deadline = Date.now() + (opts.deadlineMs ?? DEFAULT_DEADLINE_MS)

  const inputs = buildInputs(opts)
  const counts = emptyCounts()
  const items: CrawlItemResult[] = []

  let processed = 0
  for (let i = 0; i < inputs.length; i++) {
    // Stop STARTING new inputs once the budget is spent; the rest come back in
    // `remaining`. We always finish an input we've begun (bounded by maxEvents).
    if (i > 0 && Date.now() > deadline) break

    const results = await processInput(inputs[i], { dryRun: opts.dryRun, maxEvents })
    for (const result of results) {
      counts[result.outcome]++
      items.push(result)
    }
    processed++
    if (i < inputs.length - 1) await wait(POLITE_DELAY_MS)
  }

  const leftover = inputs.slice(processed)
  return {
    dryRun: opts.dryRun,
    ranAt: new Date().toISOString(),
    counts,
    items,
    totalInputs: inputs.length,
    processedInputs: processed,
    ...(leftover.length ? { remaining: groupRemaining(leftover) } : {}),
  }
}
