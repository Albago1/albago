import type { ObservationInputV1 } from '../contract/observation'
import { normalizeDate } from '../core/normalize'
import { performerNamedIn } from '../core/match'
import { normalizeImportUrl } from '../core/url'
import type { ExtractionV1 } from '../extract/extraction'
import { extractFromJsonLdEvent, findJsonLdEvents } from '../extract/jsonld'
import { carryPerformer, MAX_LISTING_ITEMS, readListing } from '../extract/listing'
import type { PageLink } from '../extract/page'
import type { EngineDeps } from '../ports'
import { evidenceHash, observe, observeItem, type ObserveContext, type ObserveOutcome } from './observe'

/**
 * The intake for a fetched PAGE (research agent, monitoring lane). A page
 * announces one event or lists several — an artist's tour dates, a venue
 * programme, a ticket-shop list. A list is cut into one observation per event,
 * each through the normal intake (`observeItem`).
 * - 2+ schema.org Events in the JSON-LD that say where they happen: one item
 *   per Event, no AI. JSON-LD that mostly lacks the city (an artist's site
 *   naming each show "Davos (CH)") is read from the visible text instead.
 * - Otherwise the single-event reader runs first, unless the caller already
 *   knows the page is a list; when it reports a list, the listing reader
 *   (one AI call for the whole page) takes over.
 * - A confirmed performer named in the page title (an artist's own tour page)
 *   is carried to the items that name no performer.
 * Items that are over or outside the caller's window are skipped before
 * anything is written. The page itself is recorded once, so an unchanged
 * page is never read again.
 */

export type PageInput = {
  input: ObservationInputV1
  /** The page's links with their words (distillPage), for items' own pages. */
  links?: PageLink[]
}

/** 'event_list' = the caller saw the page lists events: skip the single-event reading. */
export type PageKindHint = 'auto' | 'event_list'

export type ObservePageResult = {
  kind: 'single' | 'list' | 'unchanged'
  outcomes: ObserveOutcome[]
  /** List items skipped before any write. */
  skipped: { past: number; outside_window: number }
  issues: string[]
}

type Item = { x: ExtractionV1; extractor: string; url: string | null; evidence: ObservationInputV1['evidence'] }

export async function observePage(deps: EngineDeps, page: PageInput, ctx: ObserveContext = {}, hint: PageKindHint = 'auto'): Promise<ObservePageResult> {
  const { input } = page
  const normalized = input.source_url ? normalizeImportUrl(input.source_url) : null
  const pageHash = await evidenceHash(input.evidence)
  if (normalized) {
    const seen = await deps.store.observations.findByUrlAndHash(normalized, pageHash)
    if (seen) {
      const outcome: ObserveOutcome = { outcome: 'unchanged', observationId: seen.id, occurrenceId: seen.occurrence_id, title: seen.extracted?.title ?? null, start_date: seen.extracted?.start_date ?? null, issues: [] }
      return { kind: 'unchanged', outcomes: [outcome], skipped: { past: 0, outside_window: 0 }, issues: [] }
    }
  }

  const ldEvents = findJsonLdEvents(input.evidence.jsonld)
  if (ldEvents.length >= 2) {
    const items = jsonLdItems(ldEvents, input, normalized)
    if (items.filter((i) => i.x.locality).length * 2 < items.length) return listFromAi(deps, page, ctx, normalized, pageHash, false)
    await recordPage(deps, input, normalized, pageHash, 'jsonld@1', items.length)
    return { kind: 'list', ...(await observeItems(deps, input, ctx, items)), issues: [] }
  }

  if (hint === 'auto') {
    const single = await observe(deps, input, ctx)
    if (single.outcome !== 'not_event' || !single.issues.includes('page_lists_events')) {
      return { kind: 'single', outcomes: [single], skipped: { past: 0, outside_window: 0 }, issues: [] }
    }
    // The single-event reader recorded the page and said it is a list.
    return listFromAi(deps, page, ctx, normalized, pageHash, true)
  }

  return listFromAi(deps, page, ctx, normalized, pageHash, false)
}

function jsonLdItems(nodes: Record<string, unknown>[], input: ObservationInputV1, normalized: string | null): Item[] {
  const seen = new Set<string>()
  const items: Item[] = []
  for (const node of nodes.slice(0, MAX_LISTING_ITEMS)) {
    const x = extractFromJsonLdEvent(node)
    const key = `${x.title}|${x.start_date}|${x.start_time}`
    if (seen.has(key)) continue
    seen.add(key)
    const link = typeof node.url === 'string' ? absolute(node.url, input.source_url) : null
    const own = link ? normalizeImportUrl(link) : null
    items.push({
      x,
      extractor: 'jsonld@1',
      url: own && own !== normalized ? link : null,
      evidence: { title: x.title, text_excerpt: null, jsonld: [node], meta: listingMeta(input), media: [] },
    })
  }
  return items
}

/**
 * The one confirmed performer the page title names (an artist's own tour
 * page: "New Tour Dates - Elina Duni"), or null. A title naming several is
 * not about one artist.
 */
async function pageSubject(deps: EngineDeps, input: ObservationInputV1, ctx: ObserveContext): Promise<string | null> {
  const title = input.evidence.title
  if (!ctx.criteria || !title) return null
  const affiliation = ctx.criteria.affiliation
  const named = (await deps.store.entities.list('performer', affiliation)).filter(
    (e) => e.affiliations[affiliation]?.state === 'confirmed' && [e.name, ...e.aliases].some((n) => performerNamedIn(n, title)),
  )
  return named.length === 1 ? named[0].name : null
}

function absolute(url: string, base: string | null): string | null {
  try {
    return new URL(url, base ?? undefined).toString()
  } catch {
    return null
  }
}

function listingMeta(input: ObservationInputV1): Record<string, string> {
  return input.source_url ? { listing_url: input.source_url } : {}
}

/** The page itself, recorded once as a list: the audit trail, and the "unchanged" check next time. */
async function recordPage(deps: EngineDeps, input: ObservationInputV1, normalized: string | null, hash: string, extractor: string, items: number, error: string | null = null) {
  await deps.store.observations.insert({
    source_id: input.source_id, run_id: input.run_id, connector: input.connector, source_url: input.source_url,
    normalized_url: normalized, retrieved_at: input.retrieved_at, content_hash: hash, evidence: input.evidence,
    lead: input.lead, extracted: null, extractor, status: error ? 'failed' : 'not_event', error,
    occurrence_id: null, match: { decision: 'skipped', score: 0, reasons: ['event_list', `items:${items}`], candidate_ids: [], decided_by: 'rule' },
  })
}

async function listFromAi(deps: EngineDeps, page: PageInput, ctx: ObserveContext, normalized: string | null, pageHash: string, pageRecorded: boolean): Promise<ObservePageResult> {
  const { input } = page
  const extractor = `listing@1+llm:${deps.reasoner.id}`
  const none = { past: 0, outside_window: 0 }
  let reading
  try {
    reading = await readListing(
      deps.reasoner.extractor,
      { url: input.source_url, title: input.evidence.title, text: input.evidence.text_excerpt ?? '', links: page.links ?? [] },
      input.retrieved_at.slice(0, 10),
    )
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 500) : 'listing_failed'
    if (!pageRecorded) await recordPage(deps, input, normalized, pageHash, extractor, 0, error)
    const failed: ObserveOutcome = { outcome: 'failed', observationId: null, occurrenceId: null, title: input.evidence.title, start_date: null, issues: ['listing_failed'] }
    return { kind: 'list', outcomes: [failed], skipped: none, issues: ['listing_failed'] }
  }

  // Not a list after all: the single-event reading decides (it records the page).
  if (!pageRecorded && reading.kind !== 'event_list' && reading.items.length <= 1) {
    return { kind: 'single', outcomes: [await observe(deps, input, ctx)], skipped: none, issues: reading.issues }
  }

  if (!pageRecorded) await recordPage(deps, input, normalized, pageHash, extractor, reading.items.length)
  const items: Item[] = reading.items.map((it) => ({
    x: it.x,
    extractor,
    url: it.url,
    evidence: { title: it.x.title, text_excerpt: it.window, jsonld: [], meta: listingMeta(input), media: [] },
  }))
  return { kind: 'list', ...(await observeItems(deps, input, ctx, items)), issues: reading.issues }
}

async function observeItems(deps: EngineDeps, input: ObservationInputV1, ctx: ObserveContext, items: Item[]) {
  const today = (deps.now?.() ?? new Date()).toISOString().slice(0, 10)
  const subject = items.some((i) => !i.x.performers.length) ? await pageSubject(deps, input, ctx) : null
  const skipped = { past: 0, outside_window: 0 }
  const outcomes: ObserveOutcome[] = []
  for (const item of items) {
    const start = normalizeDate(item.x.start_date)
    if (!start) continue
    const last = normalizeDate(item.x.end_date) ?? start
    if (last < today) {
      skipped.past++
      continue
    }
    if (ctx.window && (start > ctx.window.to || last < ctx.window.from)) {
      skipped.outside_window++
      continue
    }
    if (subject) carryPerformer(item.x, subject)
    outcomes.push(await observeItem(deps, { ...input, evidence: item.evidence }, ctx, { extraction: item.x, extractor: item.extractor, url: item.url }))
  }
  return { outcomes, skipped }
}
