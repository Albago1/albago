import { CanonicalOccurrenceV1 } from '../contract/occurrence'
import type { ObservationInputV1 } from '../contract/observation'
import type { RelevanceCriteriaV1 } from '../contract/goal'
import { buildCandidate, type CandidateFields } from '../core/candidate'
import { venueMatchTier } from '../core/match'
import { mergeIntoExisting, reconcile } from '../core/reconcile'
import { evaluateRelevance } from '../core/relevance'
import { normalizeImportUrl } from '../core/url'
import { emptyExtraction, type ExtractionV1 } from '../extract/extraction'
import { extractFromJsonLdEvent, findJsonLdEvents } from '../extract/jsonld'
import { extractWithModel } from '../extract/llm'
import type { EngineDeps, MatchRecord, OccurrenceRecord } from '../ports'

/**
 * The single intake every acquisition lane feeds (research agent, monitoring,
 * direct connectors, manual paste). Evidence in → extraction → candidate →
 * venue → reconciliation → validated canonical occurrence (needs_review).
 * Nothing here publishes anywhere.
 */

export type ObserveContext = {
  criteria?: RelevanceCriteriaV1
  /** Inclusive window; events outside it are recorded but not turned into occurrences. */
  window?: { from: string; to: string }
}

export type ObserveOutcome = {
  outcome: 'new' | 'attached' | 'possible_duplicate' | 'unchanged' | 'not_event' | 'past' | 'outside_window' | 'failed'
  observationId: string | null
  occurrenceId: string | null
  title: string | null
  start_date: string | null
  issues: string[]
}

async function sha256(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** JSON-LD first; the AI fills what JSON-LD lacks (or reads the page when there is none). */
async function extract(deps: EngineDeps, input: ObservationInputV1, referenceDate: string): Promise<{ x: ExtractionV1; extractor: string }> {
  const ldEvents = findJsonLdEvents(input.evidence.jsonld)
  const fromLd = ldEvents.length === 1 ? extractFromJsonLdEvent(ldEvents[0]) : null
  const needsAi =
    !fromLd || !fromLd.start_date || !fromLd.start_time || !fromLd.venue_name || !fromLd.event_type || !fromLd.locality
  if (!needsAi && fromLd) return { x: fromLd, extractor: 'jsonld@1' }

  const text = input.evidence.text_excerpt ?? ''
  if (!text && !fromLd) {
    const x = emptyExtraction()
    x.issues.push('no_readable_evidence')
    return { x, extractor: 'none' }
  }
  const ai = await extractWithModel(
    deps.reasoner.extractor,
    {
      url: input.source_url,
      title: input.evidence.title,
      text,
      jsonldSummary: ldEvents.length ? JSON.stringify(ldEvents.slice(0, 2)).slice(0, 3000) : null,
    },
    referenceDate,
  )
  if (!fromLd) return { x: ai, extractor: `llm:${deps.reasoner.id}` }

  // Merge: stated JSON-LD values win; the AI fills the gaps it can quote.
  const merged: ExtractionV1 = { ...fromLd, issues: [...fromLd.issues, ...ai.issues], field_status: { ...fromLd.field_status } }
  for (const key of Object.keys(ai) as (keyof ExtractionV1)[]) {
    if (key === 'issues' || key === 'field_status') continue
    const current = merged[key]
    const empty = current == null || (Array.isArray(current) && current.length === 0)
    const next = ai[key]
    const has = next != null && !(Array.isArray(next) && next.length === 0)
    if (empty && has) {
      ;(merged as Record<string, unknown>)[key] = next
      if (ai.field_status[key]) merged.field_status[key] = ai.field_status[key]
    }
  }
  merged.is_event = fromLd.is_event || ai.is_event
  return { x: merged, extractor: `jsonld@1+llm:${deps.reasoner.id}` }
}

function toOccurrenceRow(fields: CandidateFields, venueId: string | null, coords: { lat: number | null; lng: number | null }) {
  return {
    title: fields.title,
    description: fields.description,
    language: fields.language,
    event_type: fields.event_type,
    tags: fields.tags,
    start: { date: fields.start_date, time: fields.start_time, timezone: fields.timezone },
    end: { date: fields.end_date, time: fields.end_time },
    status: fields.status,
    venue: { venue_id: venueId, name: fields.venue_text, address: fields.venue_address },
    location: { locality: fields.locality, country_code: fields.country_code, lat: coords.lat, lng: coords.lng },
    organizer_name: fields.organizer_name,
    performers: fields.performers,
    promotion_languages: fields.promotion_languages,
    audience_statements: fields.audience_statements,
    cultural_occasion: fields.cultural_occasion,
    price: fields.price,
    ticket_url: fields.ticket_url,
    media: fields.media,
    source_urls: fields.source_urls,
  }
}

export async function observe(deps: EngineDeps, input: ObservationInputV1, ctx: ObserveContext = {}): Promise<ObserveOutcome> {
  const now = deps.now?.() ?? new Date()
  const today = now.toISOString().slice(0, 10)
  const normalized = input.source_url ? normalizeImportUrl(input.source_url) : null
  const hash = await sha256(JSON.stringify([input.evidence.title, input.evidence.text_excerpt, input.evidence.jsonld]))
  const result = (o: Partial<ObserveOutcome> & Pick<ObserveOutcome, 'outcome'>): ObserveOutcome => ({
    observationId: null,
    occurrenceId: null,
    title: null,
    start_date: null,
    issues: [],
    ...o,
  })

  if (normalized) {
    const seen = await deps.store.observations.findByUrlAndHash(normalized, hash)
    if (seen) {
      return result({ outcome: 'unchanged', observationId: seen.id, occurrenceId: seen.occurrence_id, title: seen.extracted?.title ?? null, start_date: seen.extracted?.start_date ?? null })
    }
  }

  let extracted: { x: ExtractionV1; extractor: string }
  try {
    extracted = await extract(deps, input, input.retrieved_at.slice(0, 10))
  } catch (error) {
    const id = await deps.store.observations.insert({
      source_id: input.source_id, run_id: input.run_id, connector: input.connector, source_url: input.source_url,
      normalized_url: normalized, retrieved_at: input.retrieved_at, content_hash: hash, evidence: input.evidence,
      lead: input.lead, extracted: null, extractor: `llm:${deps.reasoner.id}`, status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 500) : 'extraction_failed', occurrence_id: null, match: null,
    })
    return result({ outcome: 'failed', observationId: id, issues: ['extraction_failed'] })
  }
  const { x, extractor } = extracted

  const observationId = await deps.store.observations.insert({
    source_id: input.source_id, run_id: input.run_id, connector: input.connector, source_url: input.source_url,
    normalized_url: normalized, retrieved_at: input.retrieved_at, content_hash: hash, evidence: input.evidence,
    lead: input.lead, extracted: x, extractor, status: x.is_event ? 'extracted' : 'not_event', error: null,
    occurrence_id: null, match: null,
  })

  const candidate = buildCandidate(x, observationId, normalized ?? input.source_url)
  if (!candidate.ok) {
    const skip: MatchRecord = { decision: 'skipped', score: 0, reasons: [candidate.reason], candidate_ids: [], decided_by: 'rule' }
    await deps.store.observations.update(observationId, { match: skip, status: candidate.reason === 'not_event' ? 'not_event' : 'extracted' })
    return result({ outcome: 'not_event', observationId, title: x.title, issues: [...candidate.issues, candidate.reason] })
  }
  const { fields, provenance, issues } = candidate

  const skip = async (reason: 'past_event' | 'outside_window', outcome: 'past' | 'outside_window') => {
    await deps.store.observations.update(observationId, { match: { decision: 'skipped', score: 0, reasons: [reason], candidate_ids: [], decided_by: 'rule' } })
    return result({ outcome, observationId, title: fields.title, start_date: fields.start_date, issues })
  }
  const lastDay = fields.end_date ?? fields.start_date
  if (lastDay < today) return skip('past_event', 'past')
  if (ctx.window && (fields.start_date > ctx.window.to || lastDay < ctx.window.from)) return skip('outside_window', 'outside_window')

  // Venue: link only on an unambiguous deterministic match in the engine's own graph.
  let venueId: string | null = null
  let coords: { lat: number | null; lng: number | null } = { lat: null, lng: null }
  if (fields.venue_text) {
    const venues = await deps.store.venues.findInLocality(fields.country_code, fields.locality)
    const matched = venues.filter((v) => [v.name, ...v.aliases].some((n) => venueMatchTier(fields.venue_text!, n).tier === 'matched'))
    if (matched.length === 1) {
      venueId = matched[0].id
      coords = { lat: matched[0].lat, lng: matched[0].lng }
      provenance.venue = { ...(provenance.venue ?? { status: 'stated', observation_id: observationId, agree: 1 }) }
    } else if (matched.length > 1) {
      issues.push('ambiguous_venue')
    }
  }

  // Relevance facts → verdict under the caller's criteria.
  let relevance: OccurrenceRecord['relevance'] = {}
  if (ctx.criteria) {
    const names = [...fields.performers, ...(fields.organizer_name ? [fields.organizer_name] : [])]
    const affiliated = names.length ? await deps.store.entities.findAffiliated(names, ctx.criteria.affiliation) : []
    const verdict = evaluateRelevance(
      ctx.criteria,
      {
        country_code: fields.country_code,
        locality: fields.locality,
        promotion_languages: fields.promotion_languages,
        audience_statements: fields.audience_statements,
        cultural_occasion: fields.cultural_occasion,
        affiliated_performers: affiliated.filter((e) => e.kind === 'performer').map((e) => e.name),
        affiliated_organizers: affiliated.filter((e) => e.kind !== 'performer').map((e) => e.name),
      },
      observationId,
      now.toISOString(),
    )
    relevance = { [ctx.criteria.id]: verdict }
  }

  // Reconcile against what the engine already believes.
  const existing = await deps.store.occurrences.findCandidates({
    start_date: fields.start_date,
    country_code: fields.country_code,
    locality: fields.locality,
  })
  const decision = reconcile(
    fields,
    existing.map((o) => ({ id: o.id, title: o.title, start_time: o.start.time, venue_text: o.venue.name, ticket_url: o.ticket_url, source_urls: o.source_urls })),
    normalized,
  )
  const match: MatchRecord = { decision: decision.decision, score: decision.score, reasons: decision.reasons, candidate_ids: decision.candidate_ids, decided_by: 'rule' }

  if (decision.decision === 'attached' && decision.target) {
    const target = existing.find((o) => o.id === decision.target)!
    const flat = {
      start_time: target.start.time, venue_text: target.venue.name, venue_address: target.venue.address,
      locality: target.location.locality, country_code: target.location.country_code, organizer_name: target.organizer_name,
      ticket_url: target.ticket_url, description: target.description, price: target.price, performers: target.performers,
      promotion_languages: target.promotion_languages, audience_statements: target.audience_statements,
      source_urls: target.source_urls, provenance: target.provenance,
    }
    const { patch, conflicts } = mergeIntoExisting(flat, fields, provenance)
    const update: Partial<OccurrenceRecord> = {
      provenance: patch.provenance as OccurrenceRecord['provenance'],
      ...(patch.start_time ? { start: { ...target.start, time: patch.start_time as string } } : {}),
      ...(patch.venue_text || patch.venue_address
        ? { venue: { ...target.venue, name: (patch.venue_text as string) ?? target.venue.name, address: (patch.venue_address as string) ?? target.venue.address } }
        : {}),
      ...(patch.locality || patch.country_code
        ? { location: { ...target.location, locality: (patch.locality as string) ?? target.location.locality, country_code: (patch.country_code as string) ?? target.location.country_code } }
        : {}),
      ...(patch.organizer_name ? { organizer_name: patch.organizer_name as string } : {}),
      ...(patch.ticket_url ? { ticket_url: patch.ticket_url as string } : {}),
      ...(patch.description ? { description: patch.description as string } : {}),
      ...(patch.price ? { price: patch.price as OccurrenceRecord['price'] } : {}),
      ...(patch.performers ? { performers: patch.performers as string[] } : {}),
      ...(patch.promotion_languages ? { promotion_languages: patch.promotion_languages as string[] } : {}),
      ...(patch.audience_statements ? { audience_statements: patch.audience_statements as string[] } : {}),
      ...(patch.source_urls ? { source_urls: patch.source_urls as string[] } : {}),
      ...(ctx.criteria ? { relevance: { ...target.relevance, ...relevance } } : {}),
      // A verified event that a new source contradicts goes back to a human.
      ...(conflicts.length && target.review_status === 'verified' ? { review_status: 'needs_review' as const } : {}),
    }
    await deps.store.occurrences.update(target.id, update)
    await deps.store.observations.update(observationId, { occurrence_id: target.id, match })
    return result({ outcome: 'attached', observationId, occurrenceId: target.id, title: fields.title, start_date: fields.start_date, issues: [...issues, ...conflicts.map((c) => `conflict_${c}`)] })
  }

  const row = toOccurrenceRow(fields, venueId, coords)
  const check = CanonicalOccurrenceV1.safeParse({
    contract: '1',
    id: '00000000-0000-4000-8000-000000000000',
    version: 1,
    ...row,
    provenance,
    relevance,
    review_status: 'needs_review',
    updated_at: now.toISOString(),
  })
  if (!check.success) {
    const problems = check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 8)
    await deps.store.observations.update(observationId, { status: 'failed', error: `contract: ${problems.join('; ')}`.slice(0, 500), match })
    return result({ outcome: 'failed', observationId, title: fields.title, start_date: fields.start_date, issues: [...issues, ...problems] })
  }

  const occurrenceId = await deps.store.occurrences.insert({ ...row, version: 1, provenance, relevance, review_status: 'needs_review' })
  await deps.store.observations.update(observationId, { occurrence_id: occurrenceId, match })
  return result({ outcome: decision.decision === 'possible_duplicate' ? 'possible_duplicate' : 'new', observationId, occurrenceId, title: fields.title, start_date: fields.start_date, issues })
}
