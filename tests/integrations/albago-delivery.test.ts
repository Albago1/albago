import { describe, expect, it } from 'vitest'
import type { CanonicalOccurrenceV1 } from '@/engine'
import { albagoLocationSlug, toAlbagoEventRow } from '@/integrations/albago/adapter'
import { deliveryDecision } from '@/integrations/albago/policy'

function occ(over: Partial<CanonicalOccurrenceV1> = {}): CanonicalOccurrenceV1 {
  return {
    contract: '1',
    id: '22222222-2222-4222-8222-222222222222',
    version: 2,
    title: "Devil's Paradise - Second Edition",
    description: null,
    language: 'sq',
    event_type: 'club_night',
    tags: [],
    start: { date: '2026-10-31', time: '18:00', timezone: 'Europe/Tirane' },
    end: { date: null, time: null },
    status: 'scheduled',
    venue: { venue_id: null, name: 'Tirana Expo Center', address: 'Rruga e Durrësit' },
    location: { locality: 'Tirana', country_code: 'AL', lat: null, lng: null },
    organizer_name: null,
    performers: [],
    promotion_languages: ['sq'],
    audience_statements: [],
    cultural_occasion: null,
    price: { state: 'paid', min: 22, max: null, currency: 'EUR', note: '€22' },
    ticket_url: null,
    media: [{ url: 'https://gowild.al/p.jpg', role: 'poster', rights: 'unknown' }],
    source_urls: ['https://gowild.al/event/devils-paradise'],
    provenance: {},
    relevance: { albanian: { verdict: 'relevant', signals: [], assessed_by: 'rules', at: '2026-10-04T12:00:00Z' } },
    review_status: 'verified',
    updated_at: '2026-10-04T12:00:00Z',
    ...over,
  }
}

describe('AlbaGo delivery policy (customer question, outside the engine)', () => {
  it('delivers a verified, timed, Albanian-relevant event', () => {
    expect(deliveryDecision(occ())).toEqual({ deliver: true })
  })

  it('D17: holds back an event whose start time is unknown', () => {
    expect(deliveryDecision(occ({ start: { date: '2026-10-31', time: null, timezone: null } }))).toEqual({ deliver: false, reasons: ['start time unknown'] })
  })

  it('never delivers unverified or civic/political events', () => {
    expect(deliveryDecision(occ({ review_status: 'needs_review' })).deliver).toBe(false)
    const civic = deliveryDecision(occ({ event_type: 'community_civic' }))
    expect(civic.deliver === false && civic.reasons[0]).toContain('not listed on AlbaGo')
  })

  it('delivers a Berlin event only when it is Albanian-relevant', () => {
    const berlin = { locality: 'Berlin', country_code: 'DE', lat: null, lng: null }
    expect(deliveryDecision(occ({ location: berlin })).deliver).toBe(true)
    expect(deliveryDecision(occ({ location: berlin, relevance: {} })).deliver).toBe(false)
  })
})

describe('AlbaGo event row', () => {
  it('maps the neutral occurrence into AlbaGo vocabulary', () => {
    const row = toAlbagoEventRow(occ(), '2026-10-04T12:00:00Z')
    expect(row).toMatchObject({
      engine_occurrence_id: occ().id,
      engine_version: 2,
      category: 'nightlife',
      location_slug: 'tirana',
      country: 'Albania',
      date: '2026-10-31',
      time: '18:00',
      price: '€22.00',
      price_from_cents: 2200,
      price_currency: 'EUR',
      origin: 'imported',
      official_source_url: 'https://gowild.al/event/devils-paradise',
      last_verified_at: '2026-10-04T12:00:00Z',
      banner_url: null,
      description: '',
    })
  })

  it('never writes "Unknown" for an unknown price, and marks free events', () => {
    expect(toAlbagoEventRow(occ({ price: { state: 'unknown', min: null, max: null, currency: null, note: 'Unknown' } }), null).price).toBeNull()
    expect(toAlbagoEventRow(occ({ price: { state: 'free', min: null, max: null, currency: null, note: 'Hyrja falas' } }), null)).toMatchObject({ price: 'Free', price_from_cents: 0 })
  })

  it('builds AlbaGo location slugs from canonical localities', () => {
    expect(albagoLocationSlug('Tirana')).toBe('tirana')
    expect(albagoLocationSlug('Durrës')).toBe('durres')
    expect(albagoLocationSlug('New York')).toBe('new-york')
  })
})
