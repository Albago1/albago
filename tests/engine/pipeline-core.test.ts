import { describe, expect, it } from 'vitest'
import {
  buildCandidate,
  canonicalLocality,
  emptyExtraction,
  evaluateRelevance,
  mergeIntoExisting,
  reconcile,
  type ExtractionV1,
  type RelevanceCriteriaV1,
} from '@/engine'
import { coerceModelExtraction, quoteFoundIn } from '@/engine/server'

const OBS = '11111111-1111-4111-8111-111111111111'

function extraction(over: Partial<ExtractionV1> = {}): ExtractionV1 {
  return {
    ...emptyExtraction(),
    is_event: true,
    title: "Devil's Paradise - Second Edition",
    event_type: 'club_night',
    start_date: '2026-10-31',
    start_time: '18:00',
    venue_name: 'Tirana Expo Center',
    locality: 'Tiranë',
    price_text: '€22',
    field_status: { title: 'stated', start_date: 'stated', start_time: 'stated', venue_name: 'stated', locality: 'stated', price_text: 'stated' },
    ...over,
  }
}

describe('AI extraction quote check (no evidence → no value)', () => {
  const page = "DEVIL'S PARADISE Second Edition — Sat 31 Oct · 18:00 · Tirana Expo Center · Tickets €22"

  it('keeps fields whose quote is really on the page, accent/case-insensitively', () => {
    expect(quoteFoundIn('sat 31 oct', page)).toBe(true)
    expect(quoteFoundIn('Tirana  Expo   Center', page)).toBe(true)
    expect(quoteFoundIn('Sun 1 Nov', page)).toBe(false)
    expect(quoteFoundIn('', page)).toBe(false)
  })

  it('drops a date/time/venue/price the model could not quote', () => {
    const x = coerceModelExtraction(
      {
        is_event: true,
        title: "Devil's Paradise",
        event_type: 'club_night',
        start_date: '2026-10-31',
        start_time: '23:00', // hallucinated: page says 18:00
        venue_name: 'Tirana Expo Center',
        locality: 'Tirana',
        price_text: '€22',
        quotes: { start_date: 'Sat 31 Oct', start_time: '23:00', venue_name: 'Tirana Expo Center', locality: 'Tirana', price_text: '€22' },
      },
      page,
    )
    expect(x.start_date).toBe('2026-10-31')
    expect(x.start_time).toBeNull()
    expect(x.issues).toContain('unsupported_start_time')
    expect(x.venue_name).toBe('Tirana Expo Center')
    expect(x.price_text).toBe('€22')
    expect(x.event_type).toBe('club_night')
  })

  it('rejects categories outside the engine taxonomy and unusable output', () => {
    expect(coerceModelExtraction({ is_event: true, event_type: 'nightlife' }, '').event_type).toBeNull()
    expect(coerceModelExtraction('nonsense', '').issues).toContain('model_output_unusable')
  })
})

describe('extraction → candidate', () => {
  it('canonicalises the city, derives the country, keeps the stated time and parses the price', () => {
    const r = buildCandidate(extraction(), OBS, 'https://gowild.al/event/devil-s-paradise-second-edition')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.fields.locality).toBe('Tirana')
    expect(r.fields.country_code).toBe('AL')
    expect(r.provenance.country_code.status).toBe('derived')
    expect(r.fields.timezone).toBe('Europe/Tirane')
    expect(r.fields.start_time).toBe('18:00')
    expect(r.fields.price).toMatchObject({ state: 'paid', min: 22, currency: 'EUR' })
  })

  it('keeps an unknown time unknown and marks it missing', () => {
    const r = buildCandidate(extraction({ start_time: null }), OBS, null)
    expect(r.ok && r.fields.start_time).toBeNull()
    expect(r.ok && r.provenance.start_time.status).toBe('missing')
  })

  it('refuses non-events and undated events', () => {
    expect(buildCandidate(extraction({ is_event: false }), OBS, null)).toMatchObject({ ok: false, reason: 'not_event' })
    expect(buildCandidate(extraction({ start_date: '31.10.2026' }), OBS, null)).toMatchObject({ ok: false, reason: 'no_date' })
  })

  it('finds a known city inside the address when no locality is stated', () => {
    const r = buildCandidate(extraction({ locality: null, address: 'Rruga e Durrësit, Tiranë' }), OBS, null)
    expect(r.ok && r.fields.locality).toBe('Tirana')
    expect(r.ok && r.provenance.locality.status).toBe('derived')
  })

  it('canonical localities cover Albanian, German and English spellings', () => {
    expect(canonicalLocality('Prishtinë')).toEqual({ name: 'Prishtina', country: 'XK' })
    expect(canonicalLocality('München')).toEqual({ name: 'Munich', country: 'DE' })
    expect(canonicalLocality('Tirana 1001, Albania')).toEqual({ name: 'Tirana', country: 'AL' })
    expect(canonicalLocality('Smallville')).toEqual({ name: 'Smallville', country: null })
  })
})

describe('reconciliation', () => {
  const base = buildCandidate(extraction(), OBS, 'https://gowild.al/event/devil')
  if (!base.ok) throw new Error('fixture')
  const existing = {
    id: 'occ-1',
    title: "DEVIL'S PARADISE – Second Edition",
    start_time: '18:00',
    venue_text: 'Tirana Expo',
    ticket_url: null,
    source_urls: ['https://almanart.al/events/devils-paradise'],
  }

  it('attaches the same event seen on another site', () => {
    const d = reconcile(base.fields, [existing], 'https://gowild.al/event/devil')
    expect(d.decision).toBe('attached')
    expect(d.target).toBe('occ-1')
    expect(d.reasons).toEqual(expect.arrayContaining(['title_match', 'same_start_time']))
  })

  it('creates a new occurrence for a different event on the same day', () => {
    const d = reconcile({ ...base.fields, title: 'Jazz at the Opera', venue_text: 'TKOB' }, [existing], null)
    expect(d.decision).toBe('new')
  })

  it('flags (not merges) a same-title event at a different time', () => {
    const d = reconcile({ ...base.fields, start_time: '22:00', venue_text: 'Another Place' }, [existing], null)
    expect(d.decision).toBe('possible_duplicate')
  })

  it('merging fills gaps, counts agreement and flags a conflicting time', () => {
    const { patch, conflicts } = mergeIntoExisting(
      { start_time: '20:00', venue_text: null, price: { state: 'unknown' }, performers: ['A'], source_urls: ['u1'], provenance: { start_time: { status: 'stated', observation_id: OBS, agree: 1 } } },
      { ...base.fields, performers: ['A', 'B'] },
      base.provenance,
    )
    expect(conflicts).toEqual(['start_time'])
    expect(patch.venue_text).toBe('Tirana Expo Center')
    expect(patch.price).toMatchObject({ state: 'paid' })
    expect(patch.performers).toEqual(['A', 'B'])
    expect((patch.provenance as Record<string, { status: string }>).start_time.status).toBe('conflicting')
  })
})

describe('relevance (criteria are configuration, verdict is code)', () => {
  const criteria: RelevanceCriteriaV1 = {
    id: 'albanian',
    description: 'Albanian or Albanian-diaspora relevant',
    affiliation: 'albanian',
    keywords: ['shqiptar', 'albanian', 'albaner', 'kosov'],
    location_implies: { country_codes: ['AL', 'XK'], localities: ['Tetovo', 'Ulcinj'] },
    signals: {
      performer_affiliation: 'strong',
      organizer_affiliation: 'strong',
      audience_statement: 'strong',
      promotion_language: { languages: ['sq'], strength: 'medium' },
      cultural_occasion: 'medium',
    },
    rule: { min_strong: 1, or_min_medium: 2 },
  }
  const facts = {
    country_code: 'DE',
    locality: 'Berlin',
    promotion_languages: [] as string[],
    audience_statements: [] as string[],
    cultural_occasion: null,
    affiliated_performers: [] as string[],
    affiliated_organizers: [] as string[],
  }
  const at = '2026-10-04T18:00:00Z'

  it('location alone suffices where the criteria say so', () => {
    expect(evaluateRelevance(criteria, { ...facts, country_code: 'AL', locality: 'Tirana' }, OBS, at).verdict).toBe('relevant')
    expect(evaluateRelevance(criteria, { ...facts, country_code: 'MK', locality: 'Tetovo' }, OBS, at).verdict).toBe('relevant')
  })

  it('a Berlin event with an Albanian performer is relevant; Albanian-language promotion alone is only possible', () => {
    expect(evaluateRelevance(criteria, { ...facts, affiliated_performers: ['Alban Skenderaj'] }, OBS, at).verdict).toBe('relevant')
    expect(evaluateRelevance(criteria, { ...facts, promotion_languages: ['sq'] }, OBS, at).verdict).toBe('possible')
    expect(
      evaluateRelevance(criteria, { ...facts, promotion_languages: ['sq'], cultural_occasion: 'Dita e Pavarësisë së Kosovës' }, OBS, at).verdict,
    ).toBe('relevant')
  })

  it('a stated diaspora audience is a strong signal; nothing at all is not relevant', () => {
    expect(evaluateRelevance(criteria, { ...facts, audience_statements: ['për diasporën shqiptare në Berlin'] }, OBS, at).verdict).toBe('relevant')
    expect(evaluateRelevance(criteria, facts, OBS, at).verdict).toBe('not_relevant')
  })
})
