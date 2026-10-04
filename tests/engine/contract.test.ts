import { describe, expect, it } from 'vitest'
import {
  CanonicalOccurrenceV1,
  DiscoveryGoalV1,
  EVENT_TYPES,
  ObservationInputV1,
  contractJsonSchemas,
  type CanonicalOccurrenceV1 as Occurrence,
} from '@/engine'

const OBS = '11111111-1111-4111-8111-111111111111'

function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    contract: '1',
    id: '22222222-2222-4222-8222-222222222222',
    version: 1,
    title: 'DJ Kabay, DJ Leo Lumezi at Frekuence Club',
    description: null,
    language: 'sq',
    event_type: 'club_night',
    tags: ['techno'],
    start: { date: '2026-10-24', time: '01:00', timezone: 'Europe/Tirane' },
    end: { date: null, time: null },
    status: 'scheduled',
    venue: { venue_id: null, name: 'Frekuence Club', address: 'Liqeni Artificial, Tiranë' },
    location: { locality: 'Tirana', country_code: 'AL', lat: null, lng: null },
    organizer_name: 'Frekuence Club',
    performers: ['DJ Kabay', 'DJ Leo Lumezi'],
    promotion_languages: ['sq'],
    audience_statements: [],
    cultural_occasion: null,
    price: { state: 'unknown', min: null, max: null, currency: null, note: null },
    ticket_url: null,
    media: [],
    source_urls: ['https://www.almanart.al/events/dj-kabay-dj-leo-lumezi-dj-frns-te-frekuence-club-tirane/'],
    provenance: { start: { status: 'stated', observation_id: OBS, agree: 1 } },
    relevance: {},
    review_status: 'needs_review',
    updated_at: '2026-10-04T18:00:00Z',
    ...overrides,
  }
}

describe('CanonicalOccurrenceV1', () => {
  it('accepts a realistic occurrence with unknown time-of-end and unknown price', () => {
    expect(CanonicalOccurrenceV1.safeParse(occurrence()).success).toBe(true)
  })

  it('keeps an unknown start time as null rather than requiring a guess', () => {
    const r = CanonicalOccurrenceV1.safeParse(occurrence({ start: { date: '2026-10-24', time: null, timezone: null } }))
    expect(r.success).toBe(true)
  })

  it('rejects the almanart trap: end date before start date', () => {
    const r = CanonicalOccurrenceV1.safeParse(occurrence({ end: { date: '2026-10-23', time: null } }))
    expect(r.success).toBe(false)
  })

  it('rejects an end time before the start time on the same explicit day', () => {
    const r = CanonicalOccurrenceV1.safeParse(
      occurrence({ start: { date: '2026-10-24', time: '22:00', timezone: null }, end: { date: '2026-10-24', time: '02:00' } }),
    )
    expect(r.success).toBe(false)
  })

  it('allows an overnight end time when the end date is not stated', () => {
    const r = CanonicalOccurrenceV1.safeParse(
      occurrence({ start: { date: '2026-10-24', time: '22:00', timezone: null }, end: { date: null, time: '04:00' } }),
    )
    expect(r.success).toBe(true)
  })

  it('rejects a "free" event that carries a positive price', () => {
    const r = CanonicalOccurrenceV1.safeParse(
      occurrence({ price: { state: 'free', min: 1000, max: null, currency: 'ALL', note: null } }),
    )
    expect(r.success).toBe(false)
  })

  it('rejects a paid amount without a currency', () => {
    const r = CanonicalOccurrenceV1.safeParse(
      occurrence({ price: { state: 'paid', min: 22, max: null, currency: null, note: null } }),
    )
    expect(r.success).toBe(false)
  })

  it('rejects half a coordinate pair', () => {
    const r = CanonicalOccurrenceV1.safeParse(
      occurrence({ location: { locality: 'Tirana', country_code: 'AL', lat: 41.3, lng: null } }),
    )
    expect(r.success).toBe(false)
  })

  it('rejects non-ISO country codes and consumer-specific categories', () => {
    expect(
      CanonicalOccurrenceV1.safeParse(occurrence({ location: { locality: 'Tirana', country_code: 'Albania', lat: null, lng: null } })).success,
    ).toBe(false)
    expect(
      CanonicalOccurrenceV1.safeParse({ ...occurrence(), event_type: 'nightlife' }).success,
    ).toBe(false)
  })
})

describe('taxonomy', () => {
  it('stays small and neutral (10–20 types, includes community_civic and other)', () => {
    expect(EVENT_TYPES.length).toBeGreaterThanOrEqual(10)
    expect(EVENT_TYPES.length).toBeLessThanOrEqual(20)
    expect(EVENT_TYPES).toContain('community_civic')
    expect(EVENT_TYPES).toContain('other')
  })
})

describe('ObservationInputV1', () => {
  it('accepts fetched evidence with a search lead', () => {
    const r = ObservationInputV1.safeParse({
      connector: 'research_agent',
      source_id: null,
      source_url: 'https://gowild.al/event/devil-s-paradise-second-edition',
      retrieved_at: '2026-10-04T18:00:00Z',
      evidence: { title: "Devil's Paradise", text_excerpt: 'Sat 31 Oct · 18:00', jsonld: [], meta: {}, media: [] },
      lead: { query: 'Tirana nightlife events October 2026', snippet: null },
      run_id: null,
    })
    expect(r.success).toBe(true)
  })
})

describe('DiscoveryGoalV1', () => {
  const budget = { max_searches: 20, max_fetches: 60, max_tokens: 200_000, max_minutes: 10 }

  it('accepts a city goal and a worldwide community goal without engine changes', () => {
    expect(
      DiscoveryGoalV1.safeParse({
        id: 'tirana-14d',
        label: 'Tirana, next 14 days',
        geography: { country_codes: ['AL'], localities: ['Tirana'] },
        horizon_days: 14,
        budget,
      }).success,
    ).toBe(true)
    expect(
      DiscoveryGoalV1.safeParse({
        id: 'hr-music-30d',
        label: 'Croatia music and nightlife, 30 days',
        geography: { country_codes: ['HR'] },
        categories: ['concert', 'club_night'],
        horizon_days: 30,
        budget,
      }).success,
    ).toBe(true)
    expect(
      DiscoveryGoalV1.safeParse({
        id: 'diaspora-worldwide',
        label: 'Community events worldwide',
        geography: { scope: 'worldwide' },
        horizon_days: 30,
        relevance: {
          id: 'example_community',
          description: 'Relevant to an example community',
          affiliation: 'example',
          location_implies: { country_codes: ['XK'] },
          signals: { performer_affiliation: 'strong', promotion_language: { languages: ['sq'], strength: 'medium' } },
          rule: { min_strong: 1, or_min_medium: 2 },
        },
        budget,
      }).success,
    ).toBe(true)
  })
})

describe('JSON Schema export', () => {
  it('produces JSON Schemas for the public contract', () => {
    const schemas = contractJsonSchemas()
    expect(Object.keys(schemas)).toEqual([
      'CanonicalOccurrenceV1',
      'ObservationInputV1',
      'DiscoveryGoalV1',
      'RelevanceCriteriaV1',
    ])
    expect(JSON.stringify(schemas.CanonicalOccurrenceV1)).toContain('club_night')
  })
})
