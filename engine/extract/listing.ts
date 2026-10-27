import { generateText, type LanguageModel } from 'ai'
import { EVENT_TYPES } from '../contract/taxonomy'
import { foldText } from '../core/text'
import { emptyExtraction, type ExtractionV1 } from './extraction'
import { quoteFoundIn, quoteNorm, quoteStatesDay } from './llm'
import { parseModelJson } from './modelJson'
import type { PageLink } from './page'

/**
 * AI reading of a page that lists SEVERAL events (an artist's tour dates, a
 * venue programme, a ticket-shop list) into one extraction per event. The
 * single-event reader's anti-hallucination contract, enforced in code:
 * - date, time, venue, city and price must be quoted word for word;
 * - an item's time, venue, city and price must sit near its date on the page,
 *   so one row's date can't be paired with another row's venue;
 * - titles and performers must be written on the page; links must be links
 *   the page actually has.
 * Facts the page states once for all its events (the artist of a tour page,
 * the venue of a venue's own programme) carry over to items that lack them.
 */

export const MAX_LISTING_ITEMS = 30
/** How far (characters of page text) an item's details may sit from its date. */
const NEARBY = 600

export type ListingItem = {
  x: ExtractionV1
  /** The event's own page or ticket page, from the page's links. */
  url: string | null
  /** The stretch of page text around the item, kept as its evidence. */
  window: string
}

export type ListingReading = {
  kind: 'event_list' | 'single_event' | 'no_events'
  items: ListingItem[]
  issues: string[]
}

const SYSTEM = `You read ONE web page (visible text and its links) that may list SEVERAL events — an artist's tour dates, a venue or festival programme, a ticket-shop list — and return each event as strict JSON.

Rules:
1. NEVER invent. Unknown = null (or []). Only events this page itself lists.
2. For each event's date, time, venue_name, locality and price_text, copy into its "quotes" the exact words from the page (2–80 characters). If you cannot quote it, return null for that field.
3. Dates as ISO YYYY-MM-DD, resolved with the reference date given. If the year is missing, use the next occurrence on or after the reference date. Month names may be Albanian (janar, shkurt, mars, prill, maj, qershor, korrik, gusht, shtator, tetor, nëntor, dhjetor), German, Italian, French, Spanish or English. Times 24h HH:MM, start time over doors.
4. "page" holds facts the page states ONCE for all its events: the artist of a tour page (performer), the venue of a venue's own programme (venue_name, locality, country), the organizer. Quote them too. null when not stated once for all events.
5. title: the event's own title exactly as written on the page; null when the row has none (typical for tour dates).
6. performers: names as written in that row; [] when the row names none.
7. link: the URL of that event's own page or ticket page, chosen ONLY from the "Links" list; null if none fits.
8. event_type: exactly one of ${EVENT_TYPES.join(', ')}.
9. languages: ISO 639-1 codes of the language that row is written in.
10. page_kind: "event_list" when the page lists several dated events, "single_event" when it announces just one, "no_events" otherwise (then events = []).
11. At most ${MAX_LISTING_ITEMS} events, earliest first. Skip events that ended before the reference date.

Return ONLY JSON:
{"page_kind":"event_list","page":{"performer":"","venue_name":"","locality":"","country":"","organizer_name":"","quotes":{"performer":"","venue_name":"","locality":"","organizer_name":""}},"events":[{"title":"","date":"","time":"","end_date":"","venue_name":"","address":"","locality":"","country":"","event_type":"","performers":[],"price_text":"","status":"","languages":[],"link":"","quotes":{"date":"","time":"","venue_name":"","locality":"","price_text":""}}]}`

const s = (v: unknown, max = 500): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const arr = (v: unknown, max = 20): string[] =>
  Array.isArray(v) ? v.map((x) => s(x, 200)).filter((x): x is string => !!x).slice(0, max) : []
const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** Every position of `needle` in the normalized page text. */
function positions(normText: string, needle: string | null): number[] {
  const n = needle ? quoteNorm(needle) : ''
  if (n.length < 2) return []
  const out: number[] = []
  for (let i = normText.indexOf(n); i !== -1 && out.length < 50; i = normText.indexOf(n, i + 1)) out.push(i)
  return out
}

const near = (a: number[], b: number[]) => a.some((x) => b.some((y) => Math.abs(x - y) <= NEARBY))

const linkKey = (url: string) => url.replace(/\/+$/, '')

/** The page's own link the model pointed at (absolute), or null when it isn't one the page has. */
function pageLink(raw: string | null, links: PageLink[], pageUrl: string | null): string | null {
  if (!raw) return null
  let url: string
  try {
    url = new URL(raw, pageUrl ?? undefined).toString()
  } catch {
    return null
  }
  if (pageUrl && linkKey(url) === linkKey(pageUrl)) return null
  return links.find((l) => linkKey(l.url) === linkKey(url))?.url ?? null
}

/**
 * The page's own artist (a tour page) on an item that names no performer. A
 * row titled only by its place ("Davos (CH)") then reads "Elina Duni: Davos (CH)".
 */
export function carryPerformer(x: ExtractionV1, performer: string): void {
  if (x.performers.length) return
  x.performers = [performer]
  x.field_status.performers = 'stated'
  if (x.title && !foldText(x.title).includes(foldText(performer))) {
    x.title = `${performer}: ${x.title}`
    x.field_status.title = 'derived'
  }
}

type PageFacts = { performer: string | null; venue_name: string | null; locality: string | null; country: string | null; organizer_name: string | null }

function pageFacts(raw: Record<string, unknown>, pageText: string): PageFacts {
  const quotes = obj(raw.quotes)
  const quoted = (field: string, max = 200) => {
    const value = s(raw[field], max)
    return value && quoteFoundIn(s(quotes[field], 200), pageText) ? value : null
  }
  const performer = s(raw.performer, 200)
  return {
    performer: performer && quoteFoundIn(performer, pageText) ? performer : null,
    venue_name: quoted('venue_name'),
    locality: quoted('locality'),
    country: s(raw.country, 80),
    organizer_name: quoted('organizer_name'),
  }
}

function readItem(raw: Record<string, unknown>, page: PageFacts, pageText: string, normText: string, links: PageLink[], pageUrl: string | null): ListingItem | null {
  const quotes = obj(raw.quotes)
  const dateQuote = s(quotes.date, 200)
  const date = s(raw.date, 10)
  // The row must state its day: "next: November 2026" is not a date.
  if (!date || !quoteFoundIn(dateQuote, pageText) || !quoteStatesDay(dateQuote, date)) return null
  const datePos = positions(normText, dateQuote)

  const x = emptyExtraction()
  x.is_event = true
  x.start_date = date
  x.field_status.start_date = 'stated'

  // Quoted details count only when they sit near this item's date.
  const rowQuotes = [dateQuote!]
  for (const field of ['start_time', 'venue_name', 'locality', 'price_text'] as const) {
    const key = field === 'start_time' ? 'time' : field
    const value = s(raw[key], field === 'price_text' ? 500 : 200)
    if (!value) continue
    const quote = s(quotes[key], 200)
    if (!quoteFoundIn(quote, pageText)) {
      x.issues.push(`unsupported_${field}`)
    } else if (!near(datePos, positions(normText, quote))) {
      x.issues.push(`${field}_far_from_date`)
    } else {
      x[field] = value
      x.field_status[field] = 'stated'
      rowQuotes.push(quote!)
    }
  }
  if (x.venue_name) {
    x.address = s(raw.address, 300)
    if (x.address) x.field_status.address = 'stated'
  }

  // A title written on the page, near the date — else it is rebuilt below.
  const title = s(raw.title, 300)
  if (title && quoteFoundIn(title, pageText) && near(datePos, positions(normText, title))) {
    x.title = title
    x.field_status.title = 'stated'
  } else if (title) {
    x.issues.push('item_title_unsupported')
  }

  x.performers = arr(raw.performers, 30).filter((p) => quoteFoundIn(p, pageText))
  if (x.performers.length) x.field_status.performers = 'stated'
  x.end_date = s(raw.end_date, 10)
  if (x.end_date) x.field_status.end_date = 'stated'
  x.country = s(raw.country, 80)
  if (x.country) x.field_status.country = 'stated'
  const type = s(raw.event_type, 40)
  x.event_type = type && (EVENT_TYPES as readonly string[]).includes(type) ? (type as ExtractionV1['event_type']) : null
  const status = s(raw.status, 20)
  x.status = status && ['scheduled', 'cancelled', 'postponed', 'rescheduled'].includes(status) ? (status as ExtractionV1['status']) : null
  x.promotion_languages = arr(raw.languages, 5).map((l) => l.toLowerCase()).filter((l) => /^[a-z]{2}$/.test(l))

  // What the page states once for all of its events.
  if (page.performer) carryPerformer(x, page.performer)
  if (!x.venue_name && page.venue_name) {
    x.venue_name = page.venue_name
    x.field_status.venue_name = 'stated'
  }
  if (!x.locality && page.locality) {
    x.locality = page.locality
    x.field_status.locality = 'stated'
  }
  if (!x.country && page.country) x.country = page.country
  if (page.organizer_name) {
    x.organizer_name = page.organizer_name
    x.field_status.organizer_name = 'stated'
  }

  // Tour rows carry no title: "<artist> in <city>", derived from stated facts.
  if (!x.title && x.performers.length) {
    const place = x.locality ?? x.venue_name
    x.title = place ? `${x.performers[0]} in ${place}` : x.performers[0]
    x.field_status.title = 'derived'
  }
  if (!x.title) return null

  const url = pageLink(s(raw.link, 500), links, pageUrl)

  // Evidence for the item: its own quoted row, then the stretch of page text
  // around it (neighbouring rows share that stretch; the row line keeps them apart).
  const at = foldText(pageText).indexOf(foldText(dateQuote!))
  const around = at >= 0 ? pageText.slice(Math.max(0, at - 300), at + 700) : ''
  const window = `${rowQuotes.join(' · ')}\n${around}`.trim()
  return { x, url, window }
}

/** Turn raw model JSON into validated per-event extractions. Pure — unit-tested. */
export function coerceListing(raw: unknown, pageText: string, links: PageLink[], pageUrl: string | null): ListingReading {
  if (typeof raw !== 'object' || raw === null) return { kind: 'no_events', items: [], issues: ['model_output_unusable'] }
  const r = raw as Record<string, unknown>
  const kind = r.page_kind === 'event_list' || r.page_kind === 'single_event' ? r.page_kind : 'no_events'
  const page = pageFacts(obj(r.page), pageText)
  const normText = quoteNorm(pageText)
  const items: ListingItem[] = []
  const seen = new Set<string>()
  let dropped = 0
  for (const ev of Array.isArray(r.events) ? r.events.slice(0, MAX_LISTING_ITEMS) : []) {
    const item = readItem(obj(ev), page, pageText, normText, links, pageUrl)
    if (!item) {
      dropped++
      continue
    }
    const key = [item.x.start_date, item.x.start_time, foldText(item.x.title ?? ''), foldText(item.x.venue_name ?? '')].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  return { kind, items, issues: dropped ? [`items_dropped_${dropped}`] : [] }
}

export async function readListing(
  model: LanguageModel,
  evidence: { url: string | null; title: string | null; text: string; links: PageLink[] },
  referenceDate: string,
): Promise<ListingReading> {
  const pageText = [evidence.title ? `Title: ${evidence.title}` : null, evidence.text].filter(Boolean).join('\n')
  const prompt = [
    `Reference date: ${referenceDate}`,
    evidence.url ? `Page URL: ${evidence.url}` : null,
    `Page text:\n${pageText.slice(0, 16_000)}`,
    evidence.links.length ? `Links (text → URL):\n${evidence.links.map((l) => `${l.text} → ${l.url}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
  const { text } = await generateText({ model, system: SYSTEM, prompt, temperature: 0 })
  return coerceListing(parseModelJson(text), pageText.slice(0, 16_000), evidence.links, evidence.url)
}
