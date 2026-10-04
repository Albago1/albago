import { describe, expect, it } from 'vitest'
import type { EngineDeps, ObservationInputV1, RelevanceCriteriaV1 } from '@/engine'
import { createEngine } from '@/engine/server'
import { memoryStore } from './memoryStore'

// No network, no AI: every page here carries complete JSON-LD, so `observe`
// takes the deterministic path. A reasoner that throws proves the AI is never
// called when it isn't needed.
const NOW = new Date('2026-10-04T12:00:00Z')
const neverCalled = new Proxy({}, { get() { throw new Error('AI must not be called on complete JSON-LD') } })

function deps(store: EngineDeps['store']): EngineDeps {
  return {
    store,
    fetcher: { fetchHtml: async () => null },
    search: { id: 'none', search: async () => [] },
    reasoner: { id: 'test/none', agent: neverCalled as never, extractor: neverCalled as never },
    now: () => NOW,
  }
}

function page(url: string, event: Record<string, unknown>): ObservationInputV1 {
  return {
    connector: 'test',
    source_id: null,
    source_url: url,
    retrieved_at: NOW.toISOString(),
    evidence: { title: String(event.name), text_excerpt: `${event.name}`, jsonld: [{ '@type': 'MusicEvent', ...event }], meta: {}, media: [] },
    lead: null,
    run_id: null,
  }
}

const devils = {
  name: "Devil's Paradise - Second Edition",
  startDate: '2026-10-31T18:00:00+01:00',
  location: { '@type': 'Place', name: 'Tirana Expo Center', address: { addressLocality: 'Tiranë', addressCountry: 'AL' } },
  offers: { price: '22', priceCurrency: 'EUR' },
}

const albanian: RelevanceCriteriaV1 = {
  id: 'albanian',
  description: 'Albanian-relevant',
  affiliation: 'albanian',
  keywords: ['shqiptar', 'albanian'],
  location_implies: { country_codes: ['AL', 'XK'], localities: [] },
  signals: { performer_affiliation: 'strong' },
  rule: { min_strong: 1, or_min_medium: 2 },
}

describe('observe() — the single intake', () => {
  it('turns a JSON-LD event page into a validated occurrence awaiting review, without AI', async () => {
    const mem = memoryStore()
    const engine = createEngine(deps(mem.store))
    const out = await engine.observe(page('https://gowild.al/event/devils-paradise?utm_source=x', devils), { criteria: albanian })
    expect(out.outcome).toBe('new')
    const occ = mem.occurrences.get(out.occurrenceId!)!
    expect(occ.review_status).toBe('needs_review')
    expect(occ.location).toMatchObject({ locality: 'Tirana', country_code: 'AL' })
    expect(occ.start).toEqual({ date: '2026-10-31', time: '18:00', timezone: 'Europe/Tirane' })
    expect(occ.price).toMatchObject({ state: 'paid', min: 22, currency: 'EUR' })
    expect(occ.source_urls).toEqual(['https://gowild.al/event/devils-paradise'])
    expect(occ.relevance.albanian.verdict).toBe('relevant')
    expect(mem.observations.get(out.observationId!)!.extractor).toBe('jsonld@1')
  })

  it('the same unchanged page is not processed twice', async () => {
    const mem = memoryStore()
    const engine = createEngine(deps(mem.store))
    await engine.observe(page('https://gowild.al/event/devils-paradise', devils))
    const again = await engine.observe(page('https://gowild.al/event/devils-paradise', devils))
    expect(again.outcome).toBe('unchanged')
    expect(mem.occurrences.size).toBe(1)
  })

  it('the same event on a second site attaches to the first occurrence and merges facts', async () => {
    const mem = memoryStore()
    const engine = createEngine(deps(mem.store))
    const first = await engine.observe(page('https://gowild.al/event/devils-paradise', { ...devils, offers: undefined }))
    const second = await engine.observe(
      page('https://www.almanart.al/events/devils-paradise/', { ...devils, name: "DEVIL'S PARADISE – Second Edition", performer: [{ name: 'DJ Example' }] }),
    )
    expect(second.outcome).toBe('attached')
    expect(second.occurrenceId).toBe(first.occurrenceId)
    const occ = mem.occurrences.get(first.occurrenceId!)!
    expect(occ.source_urls).toHaveLength(2)
    expect(occ.performers).toEqual(['DJ Example'])
    expect(occ.price).toMatchObject({ state: 'paid', min: 22 })
  })

  it('records but does not create occurrences for past events or events outside the window', async () => {
    const mem = memoryStore()
    const engine = createEngine(deps(mem.store))
    const past = await engine.observe(page('https://x.al/e/old', { ...devils, startDate: '2026-09-01T20:00' }))
    const later = await engine.observe(page('https://x.al/e/later', { ...devils, startDate: '2027-03-01T20:00' }), { window: { from: '2026-10-04', to: '2026-10-18' } })
    expect(past.outcome).toBe('past')
    expect(later.outcome).toBe('outside_window')
    expect(mem.occurrences.size).toBe(0)
    expect(mem.observations.size).toBe(2)
  })

  it('verify applies corrections, bumps the version and records them as review actions', async () => {
    const mem = memoryStore()
    const engine = createEngine(deps(mem.store))
    const out = await engine.observe(page('https://gowild.al/event/devils-paradise', devils))
    const verified = await engine.review.verify(out.occurrenceId!, { start_time: '19:00' }, 'reviewer-1')
    expect(verified.review_status).toBe('verified')
    expect(verified.version).toBe(2)
    expect(verified.start.time).toBe('19:00')
    expect(mem.reviewActions).toContainEqual(expect.objectContaining({ action: 'edit', changes: { start_time: { from: '18:00', to: '19:00' } } }))
    await expect(engine.review.verify(out.occurrenceId!, { country_code: 'Albania' }, 'r')).rejects.toThrow()
  })
})
