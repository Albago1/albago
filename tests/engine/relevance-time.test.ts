import { describe, expect, it } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import { evaluateRelevance, localDateTime, timezoneForPlace, type EngineDeps, type OccurrenceRecord, type RelevanceFacts } from '@/engine'
import { applyEdits, createEngine } from '@/engine/server'
import { ALBANIAN_RELEVANCE } from '@/integrations/albago/goals'
import { memoryStore } from './memoryStore'

const AT = '2026-10-21T12:00:00.000Z'
const facts = (f: Partial<RelevanceFacts>): RelevanceFacts => ({
  country_code: 'US',
  locality: 'Old Bridge',
  promotion_languages: [],
  audience_statements: [],
  cultural_occasion: null,
  affiliated_performers: [],
  affiliated_organizers: [],
  ...f,
})
const verdict = (f: Partial<RelevanceFacts>) => evaluateRelevance(ALBANIAN_RELEVANCE, facts(f), null, AT)

describe('Albanian relevance reads the event’s own words', () => {
  it('a title that says Albanian is enough on its own', () => {
    const v = verdict({ title: 'Kids Albanian Independence Party — Old Bridge, NJ', cultural_occasion: 'Albanian Independence Day' })
    expect(v.verdict).toBe('relevant')
    expect(v.signals.map((s) => s.kind)).toContain('title_keyword')
  })

  it('an Albanian organizer name counts (Shoqata = association)', () => {
    expect(verdict({ title: 'Autumn party', organizer_name: 'Dibra Community Organization (Shoqata Dibra)' }).verdict).toBe('relevant')
  })

  it('a band named after an Albanian city is a medium hint; with the artist confirmed it is relevant', () => {
    const name = { title: 'SHKODRA ELEKTRONIKE, SO36, 25.11.2026', performers: ['Shkodra Elektronike'], country_code: 'DE', locality: 'Berlin' }
    const hint = verdict(name)
    expect(hint.verdict).toBe('possible')
    expect(hint.signals).toEqual([expect.objectContaining({ kind: 'place_mention', value: 'Shkodër', strength: 'medium' })])
    expect(verdict({ ...name, affiliated_performers: ['Shkodra Elektronike'] }).verdict).toBe('relevant')
    expect(verdict({ ...name, description: 'Albanian electronic duo from Shkodër' }).verdict).toBe('relevant') // two medium hints
  })

  it('unrelated events stay not relevant', () => {
    expect(verdict({ title: 'Halloween Disco', description: 'Costume party with DJs', organizer_name: 'Club X', country_code: 'DE', locality: 'Berlin' }).verdict).toBe('not_relevant')
  })
})

describe('event times are read in the event’s own timezone', () => {
  it('converts an offset time to local time when the zone is known', () => {
    expect(localDateTime('2026-11-25T20:00:00+01:00', 'Europe/Berlin', 'DE')).toEqual({ date: '2026-11-25', time: '20:00', dropped: false })
    expect(localDateTime('2026-07-10T19:00:00Z', 'Europe/Berlin', 'DE')).toEqual({ date: '2026-07-10', time: '21:00', dropped: false })
    expect(localDateTime('2026-10-31T23:30:00Z', 'Europe/Tirane', 'AL')).toEqual({ date: '2026-11-01', time: '00:30', dropped: false })
  })
  it('drops a UTC time when the local zone is unknown (midnight New York stored as 05:00Z)', () => {
    expect(localDateTime('2026-11-15T05:00:00+00:00', null, 'US')).toEqual({ date: '2026-11-15', time: null, dropped: true })
  })
  it('uses the state for multi-zone countries, and treats local midnight stored as UTC as no time', () => {
    // Gala in New Jersey: 22:00Z is 5 PM Eastern (the page says 5:00 PM).
    expect(localDateTime('2026-11-14T22:00:00+00:00', timezoneForPlace('US', 'NJ'), 'US')).toEqual({ date: '2026-11-14', time: '17:00', dropped: false })
    expect(localDateTime('2026-10-23T22:00:00+00:00', timezoneForPlace('US', 'Connecticut'), 'US')).toEqual({ date: '2026-10-23', time: '18:00', dropped: false })
    // Kids party: 05:00Z is midnight in New Jersey — the CMS had no time.
    expect(localDateTime('2026-11-15T05:00:00+00:00', timezoneForPlace('US', 'NJ'), 'US')).toEqual({ date: '2026-11-15', time: null, dropped: true })
    expect(timezoneForPlace('DE', null)).toBe('Europe/Berlin')
    expect(timezoneForPlace('US', null)).toBeNull()
  })
  it('keeps times written without an offset, and local offsets in unknown zones', () => {
    expect(localDateTime('2026-11-15T19:00:00', null, 'US')).toEqual({ date: '2026-11-15', time: '19:00', dropped: false })
    expect(localDateTime('2026-11-15T19:00:00-05:00', null, 'US')).toEqual({ date: '2026-11-15', time: '19:00', dropped: false })
    expect(localDateTime('2026-11-15', null, 'US')).toEqual({ date: '2026-11-15', time: null, dropped: false })
  })
})

function occurrence(over: Partial<OccurrenceRecord> = {}): Omit<OccurrenceRecord, 'id' | 'created_at' | 'updated_at' | 'verified_at' | 'verified_by'> {
  return {
    version: 1,
    title: 'SHKODRA ELEKTRONIKE, SO36',
    description: null,
    language: null,
    event_type: 'concert',
    tags: [],
    start: { date: '2026-11-25', time: '20:00', timezone: 'Europe/Berlin' },
    end: { date: null, time: null },
    status: 'scheduled',
    venue: { venue_id: null, name: 'SO36', address: null },
    location: { locality: 'Berlin', country_code: 'DE', lat: null, lng: null },
    organizer_name: 'Ballkan World Music Management',
    performers: ['Shkodra Elektronike'],
    promotion_languages: [],
    audience_statements: [],
    cultural_occasion: null,
    price: { state: 'unknown', min: null, max: null, currency: null, note: null },
    ticket_url: null,
    media: [],
    source_urls: ['https://www.so36.com/x'],
    provenance: {},
    relevance: { albanian: { verdict: 'not_relevant', signals: [], assessed_by: 'rules', at: AT } },
    review_status: 'needs_review',
    ...over,
  } as Omit<OccurrenceRecord, 'id' | 'created_at' | 'updated_at' | 'verified_at' | 'verified_by'>
}

function engineFor(mem: ReturnType<typeof memoryStore>) {
  const m = new MockLanguageModelV4({ doGenerate: async () => ({ content: [], finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }, warnings: [] }) })
  const deps: EngineDeps = { store: mem.store, now: () => new Date(AT), reasoner: { id: 't', agent: m, extractor: m }, search: { id: 'n', search: async () => [] }, fetcher: { fetchHtml: async () => null } }
  return createEngine(deps)
}

describe('re-checking open suggestions', () => {
  it('confirming an artist makes their pending events relevant; human decisions are never overwritten', async () => {
    const mem = memoryStore()
    const engine = engineFor(mem)
    const pending = await mem.store.occurrences.insert(occurrence())
    const ruledOut = await mem.store.occurrences.insert(
      occurrence({ title: 'Shkodra Elektronike after-party', relevance: { albanian: { verdict: 'not_relevant', signals: [], assessed_by: 'human', at: AT } } }),
    )

    let r = await engine.maintenance.reassessRelevance(ALBANIAN_RELEVANCE)
    expect(r).toMatchObject({ checked: 2, now_relevant: 0 })
    expect(mem.occurrences.get(pending)!.relevance.albanian.verdict).toBe('possible') // the place hint alone

    await engine.entities.ensureAffiliated('performer', ['Shkodra Elektronike'], 'albanian')
    r = await engine.maintenance.reassessRelevance(ALBANIAN_RELEVANCE)
    expect(r.now_relevant).toBe(1)
    expect(mem.occurrences.get(pending)!.relevance.albanian.verdict).toBe('relevant')
    expect(mem.occurrences.get(ruledOut)!.relevance.albanian).toMatchObject({ verdict: 'not_relevant', assessed_by: 'human' })

    // Idempotent: nothing changes on a second run.
    expect((await engine.maintenance.reassessRelevance(ALBANIAN_RELEVANCE)).changed).toBe(0)
  })

  it('a reviewer can confirm relevance; it is recorded as a human decision with the evidence kept', () => {
    const o = { ...occurrence({ relevance: { albanian: { verdict: 'possible', signals: [{ kind: 'place_mention', value: 'Shkodër', strength: 'medium', observation_id: null }], assessed_by: 'rules', at: AT } } }), id: 'x', created_at: AT, updated_at: AT, verified_at: null, verified_by: null } as OccurrenceRecord
    const { next, changes } = applyEdits(o, { relevance: { criteria_id: 'albanian', verdict: 'relevant' }, event_type: 'concert' })
    expect(next.relevance.albanian).toMatchObject({ verdict: 'relevant', assessed_by: 'human' })
    expect(next.relevance.albanian.signals.map((s) => s.kind)).toEqual(['place_mention', 'reviewer'])
    expect(changes['relevance.albanian']).toEqual({ from: 'possible', to: 'relevant' })
  })
})
