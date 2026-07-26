import type { PosterReading } from '@/lib/ai/posterReader'
import type { LensResolution } from '@/lib/lens/resolve'

/**
 * Event Radar (RADAR-1) transparent assessment. Pure — no network, safe in
 * tests.
 *
 * Spec §8 is explicit: do NOT lean on the model's opaque `confidence` number.
 * Instead we derive an honest, explainable verdict from OBSERVABLE facts — which
 * fields the page actually stated, whether the city/venue resolved, whether the
 * date is in the past, whether a duplicate exists. The admin sees the concrete
 * warnings and missing fields; the high/medium/low label is just their summary,
 * never a mystery.
 *
 * Governing rule inherited from the extraction contract: a wrong assertion is
 * worse than an admitted gap. We never invent — we only report what's absent or
 * uncertain.
 */

export type RadarWarningCode =
  | 'no_date'
  | 'past_date'
  | 'not_single_event'
  | 'city_unmatched'
  | 'city_remote_only'
  | 'venue_unmatched'
  | 'venue_suggested'
  | 'coords_unverified'
  | 'duplicate_live'
  | 'duplicate_in_review'
  | 'low_model_confidence'
  | 'no_description'

export type RadarWarning = { code: RadarWarningCode; message: string }

export type RadarConfidence = 'high' | 'medium' | 'low'

export type RadarAssessment = {
  confidence: RadarConfidence
  /** Field names the page never stated — surfaced so the admin knows to fill them. */
  missingFields: string[]
  /** Concrete, observable concerns — the real signal (spec §8). */
  warnings: RadarWarning[]
}

// Fields that meaningfully define an event. Reported when the reading left them
// empty. Ordered by how load-bearing they are for a usable listing.
const IMPORTANT_FIELDS: Array<{ key: keyof PosterReading; label: string }> = [
  { key: 'title', label: 'title' },
  { key: 'date', label: 'date' },
  { key: 'time', label: 'time' },
  { key: 'venue_name', label: 'venue' },
  { key: 'city', label: 'city' },
  { key: 'country', label: 'country' },
  { key: 'description', label: 'description' },
  { key: 'price', label: 'price' },
  { key: 'category', label: 'category' },
]

// Below this model self-rating we add a (non-decisive) caution. The number is
// never shown to the admin — only this boolean threshold influences the label.
const LOW_MODEL_CONFIDENCE = 0.45

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** Has the resolution produced usable coordinates (matched venue or geocode)? */
function hasVerifiedCoords(resolution: LensResolution | null): boolean {
  if (!resolution) return false
  if (resolution.venue.status === 'matched' && resolution.venue.place) {
    const p = resolution.venue.place
    if (p.lat != null && p.lng != null) return true
  }
  return resolution.geocode.status === 'address'
}

/**
 * Assess an extracted reading against its resolution. `todayIso` is the
 * reference date (YYYY-MM-DD) used for the past-event check; injected so the
 * function stays pure and deterministic in tests.
 */
export function assessReading(
  reading: PosterReading,
  resolution: LensResolution | null,
  todayIso: string,
): RadarAssessment {
  const missingFields = IMPORTANT_FIELDS.filter(({ key }) =>
    isEmpty(reading[key]),
  ).map(({ label }) => label)

  const warnings: RadarWarning[] = []
  const add = (code: RadarWarningCode, message: string) =>
    warnings.push({ code, message })

  // --- Date sanity -----------------------------------------------------------
  if (!reading.date) {
    add('no_date', 'The page does not state a readable date — confirm before publishing.')
  } else if (reading.date < todayIso) {
    add(
      'past_date',
      'The extracted date is in the past — this may be an old edition of the event.',
    )
  }

  // --- Is this actually one event? ------------------------------------------
  if (!reading.is_event) {
    add(
      'not_single_event',
      'The page may not be a single event announcement — review carefully.',
    )
  }

  // --- Location resolution ---------------------------------------------------
  const city = resolution?.city
  if (!city || city.status === 'none') {
    add('city_unmatched', 'City could not be matched to a known AlbaGo location.')
  } else if (city.status === 'remote') {
    add(
      'city_remote_only',
      'City matched only via an external lookup, not a known AlbaGo location.',
    )
  }

  const venue = resolution?.venue
  if (!isEmpty(reading.venue_name)) {
    if (!venue || venue.status === 'none') {
      add('venue_unmatched', 'Venue name could not be linked to a known place.')
    } else if (venue.status === 'suggested') {
      add('venue_suggested', 'Venue is a suggested match, not a confirmed one — verify it.')
    }
  }

  if (!hasVerifiedCoords(resolution ?? null)) {
    add('coords_unverified', 'Coordinates could not be verified — the map pin may be missing.')
  }

  // --- Duplicates ------------------------------------------------------------
  const dup = resolution?.duplicate
  if (dup?.status === 'live') {
    const which = dup.event ? ` ("${dup.event.title}")` : ''
    add('duplicate_live', `A published AlbaGo event may already cover this${which}.`)
  } else if (dup?.status === 'in_review') {
    add('duplicate_in_review', 'A pending submission may already cover this event.')
  }

  // --- Content quality -------------------------------------------------------
  if (isEmpty(reading.description)) {
    add('no_description', 'No description was extracted from the page.')
  }
  if (reading.confidence < LOW_MODEL_CONFIDENCE) {
    add(
      'low_model_confidence',
      'The reader found the page thin or ambiguous — double-check every field.',
    )
  }

  return { confidence: scoreConfidence(warnings, missingFields), missingFields, warnings }
}

// Warning codes that, alone, make a candidate untrustworthy → low.
const CRITICAL_CODES = new Set<RadarWarningCode>([
  'no_date',
  'past_date',
  'not_single_event',
  'duplicate_live',
  'duplicate_in_review',
  'low_model_confidence',
])

// Warning codes that soften confidence but don't disqualify → at most medium.
const SOFTENING_CODES = new Set<RadarWarningCode>([
  'city_unmatched',
  'city_remote_only',
  'venue_unmatched',
  'venue_suggested',
  'coords_unverified',
  'no_description',
])

/**
 * Transparent roll-up: any critical concern ⇒ low; otherwise any softening
 * concern (or a load-bearing missing field) ⇒ medium; a clean, complete,
 * resolved reading ⇒ high. Deterministic and fully explained by the lists the
 * admin already sees.
 */
export function scoreConfidence(
  warnings: RadarWarning[],
  missingFields: string[],
): RadarConfidence {
  if (warnings.some((w) => CRITICAL_CODES.has(w.code))) return 'low'

  const coreMissing = missingFields.some((f) =>
    ['title', 'date', 'venue', 'city'].includes(f),
  )
  if (coreMissing || warnings.some((w) => SOFTENING_CODES.has(w.code))) {
    return 'medium'
  }
  return 'high'
}
