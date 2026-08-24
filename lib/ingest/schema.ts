import { coercePosterReading, type PosterReading } from '@/lib/ai/posterReader'
import { normalizeImportUrl, sourceNameFromUrl } from '@/lib/radar/normalizeUrl'

/**
 * The GPT ingest contract (Phase 38). Pure — no I/O, safe in tests.
 *
 * An outside agent (a ChatGPT Custom GPT Action) posts events here. The
 * governing rule of this whole phase lives in this file: THE AGENT IS A
 * REPORTER, NOT AN AUTHORITY. Every field it sends is a claim.
 *
 * Concretely, two of its claims are accepted and then deliberately ignored:
 *
 *   - `suggested_location_slug` — kept only as evidence. The real slug always
 *     comes from resolvePoster (our cities/places + Nominatim). This is the
 *     structural fix for the observed failure mode where an outside model
 *     invents slugs ("tirana-albania", "al-tirana") that our map has never
 *     heard of. A wrong slug cannot reach the database because nothing reads it.
 *   - `lat` / `lng` — never accepted. Coordinates come from a matched venue or a
 *     geocode inside the 30 km sanity ring (lib/lens/resolve.ts), or not at all.
 *
 * Everything else is coerced through the SAME coercePosterReading the poster and
 * URL readers use, so an agent submission cannot express a shape our own
 * extractors couldn't.
 */

export const INGEST_PARSER_VERSION = 'gpt-ingest-1'

/** Per-request cap. A curated agent hand-off, not an unbounded firehose. */
export const MAX_EVENTS_PER_REQUEST = 25

/** Bodies larger than this are refused before parsing. */
export const MAX_BODY_BYTES = 256 * 1024

/**
 * The confidence stamped on an agent submission before verification.
 *
 * The agent's own self-rating is not used: a model grading its own homework is
 * the exact opaque number lib/radar/assess.ts exists to avoid. Instead, posting
 * to this endpoint IS the assertion "this is a real event", and we record that
 * assertion at a fixed, middling value — above the keep bar (0.35) so it enters
 * the queue, above the low-confidence caution (0.45) so it doesn't fake a
 * problem, and below anything that would read as verified. When the source page
 * IS readable, this is replaced wholesale by the page reading's real confidence.
 */
export const AGENT_ASSERTED_CONFIDENCE = 0.5

/** Fields the agent may send that are recorded but never trusted. */
export type IngestEvidence = {
  suggestedSlug: string | null
  agentNote: string | null
}

export type IngestItem = {
  reading: PosterReading
  /** Normalized public http(s) URL the agent found this on, when it gave one. */
  sourceUrl: string | null
  sourceName: string | null
  /** Stable dedup key: the normalized URL, or a synthetic `agent:` key. */
  dedupKey: string
  /** Agent-supplied poster/photo URL — shape-checked here, fetched later. */
  imageUrl: string | null
  evidence: IngestEvidence
}

export type ItemValidation =
  | { ok: true; item: IngestItem }
  | { ok: false; title: string; reason: string }

/** A plain http(s) URL, or null. Blocks data:/javascript:/blob: and junk. */
function httpUrl(raw: unknown, maxLen = 2000): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s || s.length > maxLen) return null
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

function text(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().slice(0, max)
  return s.length ? s : null
}

function slugPart(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Dedup key for an event the agent found somewhere unlinkable (a story, a
 * flyer photo, a word-of-mouth listing). Mirrors the `paste:` key the bulk-text
 * importer uses so re-submitting the same event collapses to one candidate.
 * Deliberately not http(s): the approval loop-closer only stamps a real page as
 * an official_source_url, and there is no page here to monitor.
 */
export function agentDedupKey(reading: PosterReading): string {
  return `agent:${slugPart(reading.title)}|${reading.date}|${slugPart(reading.venue_name)}`
}

/**
 * Validate one submitted event into an IngestItem.
 *
 * Hard-invalid is kept deliberately narrow — only a missing title, which leaves
 * nothing to identify the event by. Everything else that is thin or absent
 * (no date, no time, no venue) is allowed through to become a LOW-confidence
 * candidate with explicit missing_fields, because the response is the agent's
 * correction loop: it is told exactly what is missing so it can go back to the
 * source and look, instead of guessing to satisfy a validator.
 */
export function validateIngestEvent(raw: unknown): ItemValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, title: 'Unknown', reason: 'Each event must be a JSON object.' }
  }
  const r = raw as Record<string, unknown>

  // is_event/confidence are OURS to set, not the agent's to assert — see
  // AGENT_ASSERTED_CONFIDENCE. Spread first so a submitted value can't win.
  const reading = coercePosterReading({
    ...r,
    is_event: true,
    confidence: AGENT_ASSERTED_CONFIDENCE,
  })
  if (!reading) {
    return { ok: false, title: 'Unknown', reason: 'The event could not be read as an event object.' }
  }
  if (!reading.title) {
    return { ok: false, title: 'Unknown', reason: 'title is required.' }
  }

  const rawSource = typeof r.source_url === 'string' ? r.source_url : ''
  const sourceUrl = rawSource ? normalizeImportUrl(rawSource) : null

  return {
    ok: true,
    item: {
      reading,
      sourceUrl,
      sourceName: sourceUrl ? sourceNameFromUrl(sourceUrl) : 'GPT agent',
      dedupKey: sourceUrl ?? agentDedupKey(reading),
      imageUrl: httpUrl(r.image_url),
      evidence: {
        suggestedSlug: text(r.suggested_location_slug, 80),
        agentNote: text(r.notes_for_admin, 500),
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Source verification merge
// ---------------------------------------------------------------------------

/** One field where the agent and the source page disagreed. */
export type IngestConflict = {
  field: string
  agent: string
  page: string
  /** Which value the candidate kept. The page wins by design. */
  used: string
}

export type MergeResult = {
  merged: PosterReading
  conflicts: IngestConflict[]
}

/** Reading fields compared/merged as plain strings. */
const TEXT_FIELDS = [
  'title',
  'description',
  'date',
  'time',
  'end_time',
  'venue_name',
  'address',
  'city',
  'country',
  'price',
  'category',
  'organizer_name',
  'organizer_website',
] as const

/**
 * Merge the agent's claims with what OUR reader got from the source page.
 *
 * The page is the primary source and wins every contested field; the agent fills
 * only the gaps the page left empty. Disagreements are never silently resolved —
 * each one is returned so the admin sees "the agent said 21:00, the page says
 * 22:00, we kept 22:00". That is the difference between a pipeline that is
 * quietly wrong and one that shows its work.
 */
export function mergeAgentAndPage(agent: PosterReading, page: PosterReading): MergeResult {
  const merged: PosterReading = { ...page }
  const conflicts: IngestConflict[] = []

  for (const field of TEXT_FIELDS) {
    const agentValue = (agent[field] ?? '') as string
    const pageValue = (page[field] ?? '') as string
    if (pageValue) {
      if (agentValue && agentValue !== pageValue) {
        conflicts.push({ field, agent: agentValue, page: pageValue, used: pageValue })
      }
    } else if (agentValue) {
      // Gap-fill: the page didn't state it, the agent did. Not a conflict.
      ;(merged as unknown as Record<string, unknown>)[field] = agentValue
    }
  }

  // Lists: the page wins when it has anything at all, else keep the agent's.
  if (page.tags.length === 0) merged.tags = agent.tags
  if (page.artists.length === 0) merged.artists = agent.artists

  // Recurrence is a compound claim (rule + end + weekdays) — take it whole from
  // whichever source asserted one, rather than mixing halves of two patterns.
  if (page.recurrence === 'none' && agent.recurrence !== 'none') {
    merged.recurrence = agent.recurrence
    merged.recurrence_until = agent.recurrence_until
    merged.recurrence_days_of_week = agent.recurrence_days_of_week
  }

  // Civic is a safety flag: either source raising it is enough to route the
  // event down the human-verified civic path (product bible standing AI rule #1).
  merged.is_civic = page.is_civic || agent.is_civic
  if (merged.is_civic && !merged.category) merged.category = 'civic'

  // "The page doesn't look like a single event" is real signal, but it must not
  // silently delete an event the agent saw — an event page inside a listing
  // reads as is_event:false often enough. Keep it, and surface the disagreement;
  // assessReading turns a false here into the critical `not_single_event`.
  if (!page.is_event && agent.is_event) {
    merged.is_event = true
    conflicts.push({
      field: 'is_event',
      agent: 'yes',
      page: 'no',
      used: 'yes (kept for review)',
    })
  }

  return { merged, conflicts }
}
