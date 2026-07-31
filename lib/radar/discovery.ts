import 'server-only'
import { discoverEventLinks } from '@/lib/crawl/discover'
import { discoverFromSite } from '@/lib/crawl/site'
import { enabledSources } from '@/lib/crawl/sources'
import { importFromUrl } from './service'
import { classifyImportOutcome, type DiscoveryOutcome } from './discoveryClassify'

export type { DiscoveryOutcome } from './discoveryClassify'

/**
 * AlbaGo Discovery Agent (CRAWL-2 / "autonomous supply").
 *
 * The consolidation layer: given a SOURCE page (a venue's "what's on", a
 * ticketing catalog, a culture calendar, or a bare domain), it finds the
 * individual event pages linked from it — reusing the crawler's same-host,
 * SSRF-guarded link discovery — and runs EACH through Radar's proven
 * `importFromUrl`. Every find becomes a transparently-scored candidate in the
 * ONE review queue (event_import_candidates → /admin/event-radar), exactly like
 * a hand-pasted import. Nothing is published; an admin approves in one click.
 *
 * Why this shape:
 *  - No new extraction/scoring path — one URL in, one scored candidate out is
 *    already battle-tested in `importFromUrl` (read → resolve → assess → upsert).
 *  - Idempotent for free: `importFromUrl` keys on normalized_url, so running the
 *    same source nightly never duplicates — already-seen events return as
 *    `duplicate` (skipped), only genuinely new pages become new candidates.
 *  - The null-submitter approval bug is sidestepped: candidates carry no
 *    submitter; approval stamps the admin's id when it mints the submission.
 *
 * Trigger it two ways, same code:
 *  - Admin pastes a source URL  → runDiscovery({ sourceUrls: [url] })
 *  - Nightly cron (no URLs)      → runDiscovery({})  → the enabled registry
 */

// Politeness between event reads on a single source — one host at a time.
const POLITE_DELAY_MS = 800

// How many event pages we read per source in one run. Bounded so a single
// source can't monopolize the wall-clock budget; the rest resurface next run
// (new pages) — a source is never fully drained in one pass by design.
const DEFAULT_MAX_PER_SOURCE = 12

// Wall-clock budget for one runDiscovery call. The cron/route give ~60s; we stop
// STARTING new sources at 50s so an in-flight source finishes and the response
// serializes. Unreached sources come back in `remainingSources`.
const DEFAULT_DEADLINE_MS = 50_000

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type DiscoveryItem = {
  sourceUrl: string
  eventUrl: string
  outcome: DiscoveryOutcome
  candidateId?: string
  message?: string
}

export type DiscoveryReport = {
  ranAt: string
  sourcesRequested: number
  sourcesProcessed: number
  /** Distinct event pages found across the processed sources. */
  eventUrlsFound: number
  imported: number
  skippedDuplicate: number
  unreadable: number
  errors: number
  items: DiscoveryItem[]
  /** Sources not reached before the time budget ran out — feed straight back in. */
  remainingSources?: string[]
}

/**
 * Expand ONE source page into the event-detail URLs it links to. Tries in-page
 * link discovery first (a "/events" or "what's on" listing); if that yields
 * nothing, treats the input as a whole site and reads its sitemap/homepage.
 * Pure delegation to the crawler's bounded, same-host, SSRF-guarded discovery —
 * never a blind spider. Best-effort: returns [] (never throws) on any failure.
 */
export async function expandSource(sourceUrl: string): Promise<string[]> {
  const links = await discoverEventLinks(sourceUrl)
  if (links.length > 0) return links

  const site = await discoverFromSite(sourceUrl)
  return site.eventUrls
}

/**
 * Run discovery over a set of source pages (or the enabled registry when none
 * are given). Sequential and polite: one host at a time, a delay between reads,
 * and a wall-clock budget so a huge registry pauses and resumes across calls via
 * `remainingSources`. One bad source or page never aborts the run.
 */
export async function runDiscovery(opts: {
  sourceUrls?: string[]
  maxPerSource?: number
  deadlineMs?: number
}): Promise<DiscoveryReport> {
  const sources =
    opts.sourceUrls && opts.sourceUrls.length > 0
      ? opts.sourceUrls
      : enabledSources().map((s) => s.url)

  const maxPerSource = opts.maxPerSource ?? DEFAULT_MAX_PER_SOURCE
  const deadline = Date.now() + (opts.deadlineMs ?? DEFAULT_DEADLINE_MS)

  const report: DiscoveryReport = {
    ranAt: new Date().toISOString(),
    sourcesRequested: sources.length,
    sourcesProcessed: 0,
    eventUrlsFound: 0,
    imported: 0,
    skippedDuplicate: 0,
    unreadable: 0,
    errors: 0,
    items: [],
  }

  const seen = new Set<string>() // event URLs already handled this run (cross-source dedup)

  for (let s = 0; s < sources.length; s++) {
    // Stop STARTING new sources once the budget is spent; the rest come back in
    // remainingSources. We always finish a source we've begun (bounded above).
    if (s > 0 && Date.now() > deadline) {
      report.remainingSources = sources.slice(s)
      break
    }

    const sourceUrl = sources[s]
    const eventUrls = (await expandSource(sourceUrl)).slice(0, maxPerSource)
    report.sourcesProcessed++

    for (let i = 0; i < eventUrls.length; i++) {
      const eventUrl = eventUrls[i]
      if (seen.has(eventUrl)) continue
      seen.add(eventUrl)
      report.eventUrlsFound++

      // A discovered event is attributed to no user (imported_by null) — it was
      // found by the agent, not pasted by a human; the approving admin becomes
      // the accountable id at approval time.
      const result = await importFromUrl(eventUrl, null)
      const { outcome, candidateId, message } = classifyImportOutcome(result)
      report.items.push({ sourceUrl, eventUrl, outcome, candidateId, message })

      if (outcome === 'imported') report.imported++
      else if (outcome === 'duplicate') report.skippedDuplicate++
      else if (outcome === 'unreadable') report.unreadable++
      else report.errors++

      if (i < eventUrls.length - 1) await wait(POLITE_DELAY_MS)
    }

    if (s < sources.length - 1) await wait(POLITE_DELAY_MS)
  }

  return report
}
