import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { readEventFromUrl } from '@/lib/ai/urlReader'
import { resolvePoster, type LensResolution } from '@/lib/lens/resolve'
import {
  assessReading,
  scoreConfidence,
  type RadarConfidence,
  type RadarWarning,
} from '@/lib/radar/assess'
import { isKeepableEvent } from '@/lib/radar/discoveryClassify'
import { buildCandidateWrite, type EventImportCandidate } from '@/lib/radar/candidate'
import { adoptRemoteImage, type AdoptImageResult } from '@/lib/media/remoteImage'
import { SITE_URL } from '@/lib/seo/jsonLd'
import type { PosterReading } from '@/lib/ai/posterReader'
import {
  INGEST_PARSER_VERSION,
  MAX_EVENTS_PER_REQUEST,
  mergeAgentAndPage,
  validateIngestEvent,
  type IngestConflict,
  type IngestItem,
} from './schema'

/**
 * GPT ingest orchestration (Phase 38) — the only module that writes candidates
 * from an outside agent.
 *
 * It deliberately reuses the entire Event Radar spine rather than growing a
 * parallel one: resolvePoster (city/venue/coords/dedup), assessReading
 * (transparent confidence), buildCandidateWrite, and the event_import_candidates
 * table with its normalized_url uniqueness. An agent submission is therefore
 * indistinguishable from a URL import once it lands — same review screen, same
 * one-click approval into event_submissions, same publish path, same "nothing
 * goes live without a human" guarantee.
 *
 * The three things that ARE new here:
 *   1. Verification (§5 of the plan): we re-read the source page ourselves and
 *      let the PAGE win every contested field, reporting each disagreement.
 *   2. Image adoption: the poster becomes ours, not a hotlink.
 *   3. A response detailed enough to be a correction loop — the agent is told
 *      precisely what is missing or unverified so it can go back and look,
 *      instead of inventing a value to satisfy a validator.
 */

const TABLE = 'event_import_candidates'
const SELECT = '*'

const NONE_RESOLUTION: LensResolution = {
  city: { status: 'none', slug: '', label: '', country: '' },
  venue: { status: 'none' },
  geocode: { status: 'none' },
  duplicate: { status: 'none' },
}

/**
 * How long we keep working before handing the rest back.
 *
 * Each verified event costs a page fetch + an LLM extraction + a rate-limited
 * Nominatim hop, so a full batch can outrun the function's wall clock. Rather
 * than dying mid-batch and leaving the agent unsure what landed, we stop at the
 * budget and return the remainder as `deferred` — an explicit "resubmit these",
 * which the dedup key makes free of risk.
 */
const SOFT_BUDGET_MS = 240_000

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export type IngestOutcome =
  | 'imported' // a new reviewable candidate landed in the queue
  | 'duplicate' // this source is already a live candidate — returned, not re-read
  | 'not_event' // read fine, but it isn't a real single event — dropped
  | 'invalid' // the submitted object was unusable (no title)
  | 'deferred' // ran out of time budget — resubmit as-is
  | 'error' // the write failed

export type IngestResultItem = {
  title: string
  outcome: IngestOutcome
  candidate_id?: string
  review_url?: string
  confidence?: RadarConfidence
  missing_fields?: string[]
  warnings?: RadarWarning[]
  /** What our own resolution decided. The agent is told to trust THIS over
   *  whatever slug it guessed — that feedback is the point. */
  resolved?: {
    city_slug: string
    city_label: string
    country: string
    city_status: LensResolution['city']['status']
    venue: { status: LensResolution['venue']['status']; name: string | null }
    coordinates: 'set' | 'unknown'
  }
  source_check?: {
    status: 'verified' | 'unreadable' | 'skipped'
    conflicts: IngestConflict[]
  }
  image?: { status: AdoptImageResult['status']; url: string | null; reason?: string }
  duplicate?: {
    status: 'live' | 'in_review' | 'none'
    existing_title: string | null
    existing_slug: string | null
  }
  message?: string
}

export type IngestSummary = {
  received: number
  imported: number
  duplicate: number
  not_event: number
  invalid: number
  deferred: number
  errors: number
}

export type IngestResult = {
  summary: IngestSummary
  results: IngestResultItem[]
}

export type IngestOptions = {
  /** Re-read each source_url and let the page win on conflicts. Default true. */
  verifySource?: boolean
  /** Injected in tests. */
  now?: () => number
}

/** resolvePoster self-degrades internally; guard anyway so a resolver throw can
 *  never abort a batch — an unresolved candidate is still a usable candidate. */
async function resolveSafely(reading: PosterReading): Promise<LensResolution> {
  try {
    return await resolvePoster(reading)
  } catch {
    return NONE_RESOLUTION
  }
}

type Verification = {
  status: 'verified' | 'unreadable' | 'skipped'
  reading: PosterReading
  conflicts: IngestConflict[]
  /** The page's own og:image, when we got one — the fallback cover. */
  pageImageUrl: string | null
}

/**
 * Check the agent's claims against the source page.
 *
 * A readable page is the primary source and overrules the agent field by field
 * (mergeAgentAndPage). An unreadable page — JS-only, login-walled, blocked, the
 * known constraint from the discovery work — is not a failure: the agent's
 * version stands and the candidate is marked unverified so the admin knows the
 * difference between "two sources agree" and "one model said so".
 */
async function verify(item: IngestItem, enabled: boolean): Promise<Verification> {
  if (!enabled || !item.sourceUrl) {
    return { status: 'skipped', reading: item.reading, conflicts: [], pageImageUrl: null }
  }
  let read: Awaited<ReturnType<typeof readEventFromUrl>> = null
  try {
    read = await readEventFromUrl(item.sourceUrl, todayIso())
  } catch {
    read = null
  }
  if (!read) {
    return { status: 'unreadable', reading: item.reading, conflicts: [], pageImageUrl: null }
  }
  const { merged, conflicts } = mergeAgentAndPage(item.reading, read.reading)
  return { status: 'verified', reading: merged, conflicts, pageImageUrl: read.imageUrl }
}

const UNVERIFIED_MESSAGE: Record<'unreadable' | 'skipped', string> = {
  unreadable:
    'Submitted by an outside agent; the source page could not be read, so nothing here is confirmed against the original. Verify every field before publishing.',
  skipped:
    'Submitted by an outside agent with no readable source page. Nothing here is confirmed against an original. Verify every field before publishing.',
}

/**
 * Ingest one batch. Sequential by design: resolvePoster shares a global 1 req/s
 * Nominatim pacer, so parallelism would only queue behind itself while making
 * the time budget unpredictable.
 */
export async function ingestEvents(
  rawEvents: unknown[],
  options: IngestOptions = {},
): Promise<IngestResult> {
  const verifySource = options.verifySource !== false
  const now = options.now ?? Date.now
  const deadline = now() + SOFT_BUDGET_MS

  const batch = rawEvents.slice(0, MAX_EVENTS_PER_REQUEST)
  const results: IngestResultItem[] = []
  // Annotated with the default generics (like lib/radar/service.ts) so the
  // untyped service-role client's query builders accept plain record writes.
  const db: SupabaseClient = createAdminClient()

  for (const raw of batch) {
    const validation = validateIngestEvent(raw)
    if (!validation.ok) {
      results.push({ title: validation.title, outcome: 'invalid', message: validation.reason })
      continue
    }
    const item = validation.item
    const title = item.reading.title

    if (now() > deadline) {
      results.push({
        title,
        outcome: 'deferred',
        message: 'Time budget reached for this request. Resubmit this event; nothing was stored.',
      })
      continue
    }

    // Dedup BEFORE any paid work: a source we already hold is returned as-is,
    // never re-read and never clobbered (the Radar idempotency guarantee).
    const { data: existingRow } = await db
      .from(TABLE)
      .select(SELECT)
      .eq('normalized_url', item.dedupKey)
      .maybeSingle()
    const existing = existingRow as EventImportCandidate | null
    if (existing && existing.status !== 'failed') {
      results.push({
        title,
        outcome: 'duplicate',
        candidate_id: existing.id,
        review_url: reviewUrl(existing.id),
        message: `Already in the review queue with status "${existing.status}".`,
      })
      continue
    }

    try {
      const verification = await verify(item, verifySource)
      const reading = verification.reading

      // The keepable bar, applied after verification so a page that turns out
      // not to be an event is caught even when the agent insisted it was.
      if (!isKeepableEvent(reading)) {
        results.push({
          title,
          outcome: 'not_event',
          message: 'This does not read as a single real event; it was not queued.',
          source_check: { status: verification.status, conflicts: verification.conflicts },
        })
        continue
      }

      const resolution = await resolveSafely(reading)
      const assessment = assessReading(reading, resolution, todayIso())

      // Unverified claims cap the candidate at medium and say why. Recomputing
      // the label (rather than hand-setting it) keeps assess.ts the single
      // authority on what a confidence word means.
      const warnings: RadarWarning[] = [...assessment.warnings]
      if (verification.status !== 'verified') {
        warnings.push({
          code: 'source_unverified',
          message: UNVERIFIED_MESSAGE[verification.status],
        })
      }
      const confidence = scoreConfidence(warnings, assessment.missingFields)

      // The agent's picture first, the source page's og:image as fallback.
      const image = await adoptRemoteImage(
        item.imageUrl ?? verification.pageImageUrl,
        item.reading.title,
      )
      const imageUrl = image.status === 'none' ? null : image.url

      const write = buildCandidateWrite({
        reading,
        resolution,
        assessment: { ...assessment, confidence, warnings },
        imageUrl,
        sourceName: item.sourceName,
      })

      // Typed as a plain record: the service-role client carries no generated
      // Database types, so an inline literal infers as never[] on upsert.
      const row: Record<string, unknown> = {
        ...write,
        source_url: item.sourceUrl ?? item.dedupKey,
        normalized_url: item.dedupKey,
        // Provenance without a migration: this is how an agent-submitted row is
        // told apart from an admin URL import in the same queue.
        parser_version: INGEST_PARSER_VERSION,
        imported_by: null,
        admin_note: buildAdminNote(item, verification.conflicts),
      }

      const { data, error } = await db
        .from(TABLE)
        .upsert(row, { onConflict: 'normalized_url' })
        .select(SELECT)
        .single()

      if (error || !data) {
        console.error('[ingest] upsert failed:', error?.code ?? '', error?.message ?? '')
        results.push({ title, outcome: 'error', message: 'Could not store the candidate.' })
        continue
      }

      const candidate = data as EventImportCandidate
      results.push({
        title,
        outcome: 'imported',
        candidate_id: candidate.id,
        review_url: reviewUrl(candidate.id),
        confidence,
        missing_fields: assessment.missingFields,
        warnings,
        resolved: {
          city_slug: resolution.city.slug,
          city_label: resolution.city.label,
          country: resolution.city.country,
          city_status: resolution.city.status,
          venue: {
            status: resolution.venue.status,
            name: resolution.venue.place?.name ?? null,
          },
          coordinates: hasCoords(resolution) ? 'set' : 'unknown',
        },
        source_check: { status: verification.status, conflicts: verification.conflicts },
        image: {
          status: image.status,
          url: imageUrl,
          ...('reason' in image ? { reason: image.reason } : {}),
        },
        duplicate: {
          status: resolution.duplicate.status,
          existing_title: resolution.duplicate.event?.title ?? null,
          existing_slug: resolution.duplicate.event?.slug ?? null,
        },
      })
    } catch (err) {
      console.error('[ingest] item failed:', err)
      results.push({ title, outcome: 'error', message: 'This event could not be processed.' })
    }
  }

  // Anything past the per-request cap is reported, never silently dropped.
  for (const extra of rawEvents.slice(MAX_EVENTS_PER_REQUEST)) {
    const v = validateIngestEvent(extra)
    results.push({
      title: v.ok ? v.item.reading.title : v.title,
      outcome: 'deferred',
      message: `Over the ${MAX_EVENTS_PER_REQUEST}-event limit for one request. Resubmit it.`,
    })
  }

  return { summary: summarize(rawEvents.length, results), results }
}

function reviewUrl(id: string): string {
  return `${SITE_URL}/admin/event-radar/${id}`
}

function hasCoords(resolution: LensResolution): boolean {
  if (resolution.venue.status === 'matched' && resolution.venue.place) {
    const p = resolution.venue.place
    if (p.lat != null && p.lng != null) return true
  }
  return resolution.geocode.status === 'address'
}

/**
 * The candidate's admin note carries what the agent said for itself plus every
 * disagreement with the page. It is the one place a reviewer can see the
 * reporting history without opening the raw JSON.
 */
function buildAdminNote(item: IngestItem, conflicts: IngestConflict[]): string | null {
  const lines: string[] = []
  if (item.evidence.agentNote) lines.push(`Agent note: ${item.evidence.agentNote}`)
  if (item.evidence.suggestedSlug) {
    lines.push(
      `Agent guessed location slug "${item.evidence.suggestedSlug}" (not used — AlbaGo resolved the city itself).`,
    )
  }
  for (const c of conflicts) {
    lines.push(`Conflict on ${c.field}: agent said "${c.agent}", source page says "${c.page}" — kept "${c.used}".`)
  }
  return lines.length ? lines.join('\n').slice(0, 2000) : null
}

function summarize(received: number, results: IngestResultItem[]): IngestSummary {
  const count = (outcome: IngestOutcome) => results.filter((r) => r.outcome === outcome).length
  return {
    received,
    imported: count('imported'),
    duplicate: count('duplicate'),
    not_event: count('not_event'),
    invalid: count('invalid'),
    deferred: count('deferred'),
    errors: count('error'),
  }
}
