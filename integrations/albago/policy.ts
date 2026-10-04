import type { CanonicalOccurrenceV1, EventTypeV1 } from '@/engine'
import { ALBANIAN_RELEVANCE } from './goals'

/**
 * AlbaGo's delivery policy — the CUSTOMER question ("should AlbaGo publish
 * this verified event?"), kept out of the engine. Pure; unit-tested.
 */

/** Engine taxonomy → AlbaGo's five categories. Types AlbaGo does not list map to null. */
export const ALBAGO_CATEGORY: Record<EventTypeV1, 'nightlife' | 'music' | 'sports' | 'culture' | 'food' | null> = {
  concert: 'music',
  festival: 'music',
  club_night: 'nightlife',
  party_social: 'nightlife',
  theatre: 'culture',
  opera_ballet_classical: 'culture',
  comedy: 'culture',
  film: 'culture',
  exhibition: 'culture',
  talk_workshop: 'culture',
  family: 'culture',
  sports_match: 'sports',
  sports_participation: 'sports',
  food_drink: 'food',
  market_fair: 'food',
  community_civic: null, // AlbaGo does not list protests or civic/political events (Phase 41)
  other: 'culture',
}

export type DeliveryDecision = { deliver: true } | { deliver: false; reasons: string[] }

export function deliveryDecision(o: CanonicalOccurrenceV1): DeliveryDecision {
  const reasons: string[] = []
  if (o.review_status !== 'verified') reasons.push('not verified')
  if (ALBAGO_CATEGORY[o.event_type] === null) reasons.push(`type ${o.event_type} is not listed on AlbaGo`)
  // D17 (2026-10-04): AlbaGo requires a start time; unknown times wait in review.
  if (!o.start.time) reasons.push('start time unknown')
  if (!o.location.country_code) reasons.push('country unknown')
  if (!o.location.locality) reasons.push('city unknown')
  const relevance = o.relevance[ALBANIAN_RELEVANCE.id]?.verdict
  const inHomeland = o.location.country_code != null && ALBANIAN_RELEVANCE.location_implies.country_codes.includes(o.location.country_code)
  if (!inHomeland && relevance !== 'relevant') reasons.push('not Albanian-relevant')
  if (o.status === 'cancelled') reasons.push('cancelled')
  return reasons.length ? { deliver: false, reasons } : { deliver: true }
}
