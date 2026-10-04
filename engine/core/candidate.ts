import type { FieldProvenanceV1 } from '../contract/primitives'
import type { MediaRefV1, PriceV1 } from '../contract/occurrence'
import type { EventTypeV1 } from '../contract/taxonomy'
import type { ExtractionV1 } from '../extract/extraction'
import { countryToIso, normalizeDate, normalizeTime, parsePrice } from './normalize'
import { canonicalLocality, localityInText, timezoneForCountry } from './places'

/**
 * Extraction (what one piece of evidence says) → candidate occurrence fields
 * (contract vocabulary) + per-field provenance. Pure and deterministic.
 */

export type CandidateFields = {
  title: string
  description: string | null
  language: string | null
  event_type: EventTypeV1
  tags: string[]
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  timezone: string | null
  status: 'scheduled' | 'cancelled' | 'postponed' | 'rescheduled'
  venue_text: string | null
  venue_address: string | null
  locality: string | null
  country_code: string | null
  organizer_name: string | null
  performers: string[]
  promotion_languages: string[]
  audience_statements: string[]
  cultural_occasion: string | null
  price: PriceV1
  ticket_url: string | null
  media: MediaRefV1[]
  source_urls: string[]
}

export type CandidateResult =
  | { ok: true; fields: CandidateFields; provenance: Record<string, FieldProvenanceV1>; issues: string[] }
  | { ok: false; reason: 'not_event' | 'no_title' | 'no_date'; issues: string[] }

export function buildCandidate(x: ExtractionV1, observationId: string, sourceUrl: string | null): CandidateResult {
  const issues = [...x.issues]
  if (!x.is_event) return { ok: false, reason: 'not_event', issues }
  const title = x.title?.trim()
  if (!title) return { ok: false, reason: 'no_title', issues }
  const start_date = normalizeDate(x.start_date)
  if (!start_date) return { ok: false, reason: 'no_date', issues }

  const prov: Record<string, FieldProvenanceV1> = {}
  const mark = (field: string, status: 'stated' | 'derived' | 'missing') => {
    prov[field] = { status, observation_id: status === 'missing' ? null : observationId, agree: status === 'missing' ? 0 : 1 }
  }
  const stated = (f: keyof ExtractionV1) => (x.field_status[f] === 'stated' ? 'stated' : 'derived')

  const start_time = normalizeTime(x.start_time)
  if (x.start_time && !start_time) issues.push('unparseable_start_time')
  let end_date = normalizeDate(x.end_date)
  let end_time = normalizeTime(x.end_time)
  if (end_date && end_date < start_date) {
    issues.push('end_before_start_dropped')
    end_date = null
    end_time = null
  }
  if (end_date === start_date && start_time && end_time && end_time < start_time) {
    // Same date written for an overnight end — keep the time, drop the wrong date.
    end_date = null
  }

  // Location: stated locality/country first; a known city named in the venue
  // line or address may supply them as DERIVED, never invented.
  let locality = canonicalLocality(x.locality)
  let localityStatus: 'stated' | 'derived' | 'missing' = locality ? 'stated' : 'missing'
  if (!locality) {
    const found = localityInText(x.address) ?? localityInText(x.venue_name)
    if (found) {
      locality = found
      localityStatus = 'derived'
    }
  }
  let country_code = countryToIso(x.country)
  let countryStatus: 'stated' | 'derived' | 'missing' = country_code ? 'stated' : 'missing'
  if (!country_code && locality?.country) {
    country_code = locality.country
    countryStatus = 'derived'
  }
  if (x.country && !countryToIso(x.country)) issues.push('unrecognised_country')

  const price = parsePrice(x.price_text, x.price_min, x.price_currency)

  const fields: CandidateFields = {
    title,
    description: x.description,
    language: x.language && /^[a-z]{2}$/.test(x.language) ? x.language : null,
    event_type: x.event_type ?? 'other',
    tags: x.tags.slice(0, 20),
    start_date,
    start_time,
    end_date,
    end_time,
    timezone: timezoneForCountry(country_code),
    status: x.status ?? 'scheduled',
    venue_text: x.venue_name,
    venue_address: x.address,
    locality: locality?.name ?? null,
    country_code,
    organizer_name: x.organizer_name,
    performers: x.performers,
    promotion_languages: x.promotion_languages,
    audience_statements: x.audience_statements,
    cultural_occasion: x.cultural_occasion,
    price,
    ticket_url: x.ticket_url,
    media: x.image_url ? [{ url: x.image_url, role: 'poster', rights: 'unknown' }] : [],
    source_urls: sourceUrl ? [sourceUrl] : [],
  }

  mark('title', stated('title'))
  mark('start_date', stated('start_date'))
  mark('start_time', start_time ? stated('start_time') : 'missing')
  mark('end', end_date || end_time ? stated('end_date') : 'missing')
  mark('venue', x.venue_name ? stated('venue_name') : 'missing')
  mark('locality', localityStatus)
  mark('country_code', countryStatus)
  mark('price', price.state === 'unknown' ? 'missing' : 'stated')
  mark('ticket_url', x.ticket_url ? 'stated' : 'missing')
  mark('organizer_name', x.organizer_name ? 'stated' : 'missing')
  mark('performers', x.performers.length ? 'stated' : 'missing')
  mark('event_type', x.event_type ? 'derived' : 'missing')

  return { ok: true, fields, provenance: prov, issues }
}
