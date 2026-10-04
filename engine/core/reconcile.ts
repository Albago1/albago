import type { FieldProvenanceV1 } from '../contract/primitives'
import type { CandidateFields } from './candidate'
import { titlesMatch, venueMatchTier } from './match'

/**
 * Deterministic duplicate reconciliation v1 (no ML, no embeddings).
 * Candidates are already blocked to the same start date + country (+ locality)
 * by the store query; within that small set, explainable signals add up.
 */

export type ExistingOccurrence = {
  id: string
  title: string
  start_time: string | null
  venue_text: string | null
  ticket_url: string | null
  source_urls: string[]
}

export type ReconcileDecision = {
  decision: 'new' | 'attached' | 'possible_duplicate'
  score: number
  reasons: string[]
  target: string | null
  candidate_ids: string[]
}

export const ATTACH_THRESHOLD = 0.7
export const POSSIBLE_THRESHOLD = 0.4

export function scoreMatch(c: CandidateFields, o: ExistingOccurrence, normalizedSourceUrl: string | null): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  if (normalizedSourceUrl && o.source_urls.includes(normalizedSourceUrl)) {
    return { score: 1, reasons: ['same_source_page'] }
  }
  if (c.ticket_url && o.ticket_url && c.ticket_url === o.ticket_url) {
    score += 0.6
    reasons.push('same_ticket_url')
  }
  if (titlesMatch(c.title, o.title)) {
    score += 0.5
    reasons.push('title_match')
  }
  if (c.venue_text && o.venue_text && venueMatchTier(c.venue_text, o.venue_text).tier === 'matched') {
    score += 0.3
    reasons.push('venue_match')
  }
  if (c.start_time && o.start_time) {
    if (c.start_time === o.start_time) {
      score += 0.2
      reasons.push('same_start_time')
    } else {
      // Same title, same day, different time: maybe a second show, maybe a
      // wrong time — never attach automatically, but keep it reviewable.
      score -= 0.1
      reasons.push('different_start_time')
    }
  }
  return { score: Math.max(0, Math.min(1, Math.round(score * 100) / 100)), reasons }
}

export function reconcile(c: CandidateFields, existing: ExistingOccurrence[], normalizedSourceUrl: string | null): ReconcileDecision {
  let best: { id: string; score: number; reasons: string[] } | null = null
  const possible: string[] = []
  for (const o of existing) {
    const { score, reasons } = scoreMatch(c, o, normalizedSourceUrl)
    if (score >= POSSIBLE_THRESHOLD) possible.push(o.id)
    if (!best || score > best.score) best = { id: o.id, score, reasons }
  }
  if (best && best.score >= ATTACH_THRESHOLD) {
    return { decision: 'attached', score: best.score, reasons: best.reasons, target: best.id, candidate_ids: possible }
  }
  if (best && best.score >= POSSIBLE_THRESHOLD) {
    return { decision: 'possible_duplicate', score: best.score, reasons: best.reasons, target: null, candidate_ids: possible }
  }
  return { decision: 'new', score: best?.score ?? 0, reasons: best?.reasons ?? [], target: null, candidate_ids: [] }
}

type MergeableFields = Record<string, unknown>

/**
 * Merge a new observation into an existing occurrence: fill what was missing,
 * count agreement, and flag (never silently overwrite) disagreement.
 */
export function mergeIntoExisting(
  existing: MergeableFields & { provenance: Record<string, FieldProvenanceV1> },
  incoming: CandidateFields,
  incomingProv: Record<string, FieldProvenanceV1>,
): { patch: MergeableFields; conflicts: string[] } {
  const patch: MergeableFields = {}
  const provenance = { ...existing.provenance }
  const conflicts: string[] = []
  const simple: Array<[string, keyof CandidateFields, string]> = [
    ['start_time', 'start_time', 'start_time'],
    ['venue_text', 'venue_text', 'venue'],
    ['venue_address', 'venue_address', 'venue'],
    ['locality', 'locality', 'locality'],
    ['country_code', 'country_code', 'country_code'],
    ['organizer_name', 'organizer_name', 'organizer_name'],
    ['ticket_url', 'ticket_url', 'ticket_url'],
    ['description', 'description', 'description'],
  ]
  for (const [column, key, provKey] of simple) {
    const next = incoming[key]
    if (next == null || next === '') continue
    const current = existing[column]
    if (current == null || current === '') {
      patch[column] = next
      if (incomingProv[provKey]) provenance[provKey] = incomingProv[provKey]
    } else if (String(current).toLowerCase() === String(next).toLowerCase()) {
      const p = provenance[provKey]
      if (p) provenance[provKey] = { ...p, agree: p.agree + 1 }
    } else if (column === 'start_time' || column === 'country_code') {
      conflicts.push(column)
      provenance[provKey] = { ...(provenance[provKey] ?? { observation_id: null, agree: 0 }), status: 'conflicting' }
    }
  }
  const currentPrice = existing.price as { state?: string } | undefined
  if (currentPrice?.state === 'unknown' && incoming.price.state !== 'unknown') {
    patch.price = incoming.price
    if (incomingProv.price) provenance.price = incomingProv.price
  }
  const mergeList = (column: string, values: string[]) => {
    const current = (existing[column] as string[] | undefined) ?? []
    const added = values.filter((v) => !current.some((c) => c.toLowerCase() === v.toLowerCase()))
    if (added.length) patch[column] = [...current, ...added]
  }
  mergeList('performers', incoming.performers)
  mergeList('promotion_languages', incoming.promotion_languages)
  mergeList('audience_statements', incoming.audience_statements)
  mergeList('source_urls', incoming.source_urls)
  patch.provenance = provenance
  return { patch, conflicts }
}
