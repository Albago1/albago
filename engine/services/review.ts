import { CanonicalOccurrenceV1 } from '../contract/occurrence'
import type { EngineDeps, ObservationRow, OccurrenceRecord } from '../ports'

/**
 * Human review — the engine's truth question ("is this a real event and is
 * what we know about it right?"). Verifying is consumer-neutral; whether a
 * consumer publishes it is that consumer's delivery policy.
 * Every human decision and correction is stored in review_actions.
 */

export type ReviewItem = {
  occurrence: OccurrenceRecord
  observations: Pick<ObservationRow, 'id' | 'source_url' | 'retrieved_at' | 'extractor' | 'match' | 'lead' | 'status'>[]
  possibleDuplicates: string[]
  issues: string[]
}

/** Fields a reviewer may correct. Values are validated against the contract. */
export type ReviewEdits = Partial<{
  title: string
  event_type: OccurrenceRecord['event_type']
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  venue_name: string | null
  venue_address: string | null
  locality: string | null
  country_code: string | null
  price: OccurrenceRecord['price']
  ticket_url: string | null
  description: string | null
  status: OccurrenceRecord['status']
}>

export function toContract(o: OccurrenceRecord): CanonicalOccurrenceV1 {
  return CanonicalOccurrenceV1.parse({
    contract: '1',
    id: o.id,
    version: o.version,
    title: o.title,
    description: o.description,
    language: o.language,
    event_type: o.event_type,
    tags: o.tags,
    start: o.start,
    end: o.end,
    status: o.status,
    venue: o.venue,
    location: o.location,
    organizer_name: o.organizer_name,
    performers: o.performers,
    promotion_languages: o.promotion_languages,
    audience_statements: o.audience_statements,
    cultural_occasion: o.cultural_occasion,
    price: o.price,
    ticket_url: o.ticket_url,
    media: o.media,
    source_urls: o.source_urls,
    provenance: o.provenance,
    relevance: o.relevance,
    review_status: o.review_status,
    updated_at: o.updated_at,
  })
}

export function applyEdits(o: OccurrenceRecord, edits: ReviewEdits): { next: OccurrenceRecord; changes: Record<string, { from: unknown; to: unknown }> } {
  const next: OccurrenceRecord = structuredClone(o)
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  const set = (key: string, from: unknown, to: unknown, apply: () => void) => {
    if (to === undefined || JSON.stringify(from) === JSON.stringify(to)) return
    changes[key] = { from, to }
    apply()
    next.provenance = { ...next.provenance, [key]: { status: 'stated', observation_id: null, agree: (next.provenance[key]?.agree ?? 0) + 1 } }
  }
  set('title', o.title, edits.title, () => (next.title = edits.title!))
  set('event_type', o.event_type, edits.event_type, () => (next.event_type = edits.event_type!))
  set('start_date', o.start.date, edits.start_date, () => (next.start.date = edits.start_date!))
  set('start_time', o.start.time, edits.start_time, () => (next.start.time = edits.start_time ?? null))
  set('end_date', o.end.date, edits.end_date, () => (next.end.date = edits.end_date ?? null))
  set('end_time', o.end.time, edits.end_time, () => (next.end.time = edits.end_time ?? null))
  set('venue', o.venue.name, edits.venue_name, () => (next.venue.name = edits.venue_name ?? null))
  set('venue_address', o.venue.address, edits.venue_address, () => (next.venue.address = edits.venue_address ?? null))
  set('locality', o.location.locality, edits.locality, () => (next.location.locality = edits.locality ?? null))
  set('country_code', o.location.country_code, edits.country_code, () => (next.location.country_code = edits.country_code ?? null))
  set('price', o.price, edits.price, () => (next.price = edits.price!))
  set('ticket_url', o.ticket_url, edits.ticket_url, () => (next.ticket_url = edits.ticket_url ?? null))
  set('description', o.description, edits.description, () => (next.description = edits.description ?? null))
  set('status', o.status, edits.status, () => (next.status = edits.status!))
  return { next, changes }
}

export function createReview(deps: EngineDeps) {
  const now = () => (deps.now?.() ?? new Date()).toISOString()

  async function get(id: string): Promise<ReviewItem | null> {
    const occurrence = await deps.store.occurrences.get(id)
    if (!occurrence) return null
    const observations = await deps.store.observations.listForOccurrence(id)
    const possibleDuplicates = [
      ...new Set(observations.flatMap((ob) => ob.match?.candidate_ids ?? []).filter((c) => c !== id)),
    ]
    const issues = [...new Set(observations.flatMap((ob) => ob.extracted?.issues ?? []))]
    return {
      occurrence,
      observations: observations.map(({ id, source_url, retrieved_at, extractor, match, lead, status }) => ({ id, source_url, retrieved_at, extractor, match, lead, status })),
      possibleDuplicates,
      issues,
    }
  }

  return {
    get,

    async queue(limit = 50, status: OccurrenceRecord['review_status'] = 'needs_review'): Promise<ReviewItem[]> {
      const rows = await deps.store.occurrences.listByReviewStatus(status, limit)
      const items = await Promise.all(rows.map((r) => get(r.id)))
      return items.filter((i): i is ReviewItem => i !== null)
    },

    /** Mark an occurrence as a verified real-world event, applying the reviewer's corrections. */
    async verify(id: string, edits: ReviewEdits, actor: string | null): Promise<CanonicalOccurrenceV1> {
      const current = await deps.store.occurrences.get(id)
      if (!current) throw new Error('occurrence_not_found')
      const { next, changes } = applyEdits(current, edits)
      const verifiedAt = now()
      const candidate = { ...next, review_status: 'verified' as const, version: current.version + 1, updated_at: verifiedAt }
      const contract = toContract(candidate) // throws on invalid edits — nothing is written
      await deps.store.occurrences.update(id, {
        ...candidate,
        verified_at: verifiedAt,
        verified_by: actor,
      })
      await deps.store.reviewActions.insert({ occurrence_id: id, observation_id: null, action: Object.keys(changes).length ? 'edit' : 'verify', changes, reason: null, actor })
      if (Object.keys(changes).length) {
        await deps.store.reviewActions.insert({ occurrence_id: id, observation_id: null, action: 'verify', changes: {}, reason: null, actor })
      }
      return contract
    },

    async reject(id: string, reason: string, actor: string | null): Promise<void> {
      const current = await deps.store.occurrences.get(id)
      if (!current) throw new Error('occurrence_not_found')
      await deps.store.occurrences.update(id, { review_status: 'rejected' })
      await deps.store.reviewActions.insert({ occurrence_id: id, observation_id: null, action: 'reject', changes: {}, reason: reason.slice(0, 500), actor })
    },
  }
}
