import { describe, expect, it } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import type { EngineDeps, OccurrenceRecord } from '@/engine'
import { createEngine } from '@/engine/server'
import { albagoPriceFields } from '@/integrations/albago/adapter'
import { memoryStore } from './memoryStore'

const NOW = new Date('2026-10-21T10:00:00Z')

function engineWith(mem: ReturnType<typeof memoryStore>) {
  const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [], finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }, warnings: [] }) })
  const deps: EngineDeps = {
    store: mem.store,
    now: () => NOW,
    reasoner: { id: 'test', agent: model, extractor: model },
    search: { id: 'none', search: async () => [] },
    fetcher: { fetchHtml: async () => null },
  }
  return createEngine(deps)
}

async function add(mem: ReturnType<typeof memoryStore>, title: string, start: string, end: string | null, review: OccurrenceRecord['review_status']) {
  const id = await mem.store.occurrences.insert({
    version: 1,
    title,
    description: null,
    language: null,
    event_type: 'concert',
    tags: [],
    start: { date: start, time: '21:00', timezone: 'Europe/Tirane' },
    end: { date: end, time: null },
    status: 'scheduled',
    venue: { venue_id: null, name: null, address: null },
    location: { locality: 'Tirana', country_code: 'AL', lat: null, lng: null },
    organizer_name: null,
    performers: [],
    promotion_languages: [],
    audience_statements: [],
    cultural_occasion: null,
    price: { state: 'unknown', min: null, max: null, currency: null, note: null },
    ticket_url: null,
    media: [],
    source_urls: [`https://x.al/${title}`],
    provenance: {},
    relevance: {},
    review_status: review,
  } as unknown as Parameters<typeof mem.store.occurrences.insert>[0])
  const obs = await mem.store.observations.insert({ occurrence_id: id } as unknown as Parameters<typeof mem.store.observations.insert>[0])
  return { id, obs }
}

describe('automatic removal of ended suggestions', () => {
  it('is on by default and deletes only pending suggestions whose event is over', async () => {
    const mem = memoryStore()
    const engine = engineWith(mem)
    const yesterday = await add(mem, 'yesterday', '2026-10-20', null, 'needs_review')
    const today = await add(mem, 'today', '2026-10-21', null, 'needs_review')
    const festival = await add(mem, 'festival', '2026-10-18', '2026-10-22', 'needs_review') // still running
    const approvedPast = await add(mem, 'approved', '2026-10-01', null, 'verified')
    const rejectedPast = await add(mem, 'rejected', '2026-10-01', null, 'rejected')

    expect(await engine.maintenance.getExpiry()).toEqual({ enabled: true, grace_days: 0 })
    const run = await engine.maintenance.expireEnded()
    expect(run).toEqual({ enabled: true, removed: 1, cutoff: '2026-10-21' })

    expect(mem.occurrences.has(yesterday.id)).toBe(false)
    for (const kept of [today, festival, approvedPast, rejectedPast]) expect(mem.occurrences.has(kept.id)).toBe(true)
    // The page itself stays remembered, so it is not rediscovered as new.
    expect(mem.observations.get(yesterday.obs)?.occurrence_id).toBeNull()
    expect(await engine.maintenance.lastExpiryRun()).toMatchObject({ removed: 1, cutoff: '2026-10-21' })
  })

  it('respects the grace period and the off switch', async () => {
    const mem = memoryStore()
    const engine = engineWith(mem)
    const twoDaysAgo = await add(mem, 'two-days', '2026-10-19', null, 'needs_review')

    await engine.maintenance.setExpiry({ enabled: true, grace_days: 3 }, 'admin')
    expect((await engine.maintenance.expireEnded()).removed).toBe(0)
    expect(mem.occurrences.has(twoDaysAgo.id)).toBe(true)

    await engine.maintenance.setExpiry({ enabled: false, grace_days: 0 }, 'admin')
    expect(await engine.maintenance.expireEnded()).toMatchObject({ enabled: false, removed: 0 })
    expect(mem.occurrences.has(twoDaysAgo.id)).toBe(true)

    await engine.maintenance.setExpiry({ enabled: true, grace_days: 1 }, 'admin')
    expect((await engine.maintenance.expireEnded()).removed).toBe(1)
  })

  it('rejects invalid settings and falls back to the default for a broken stored value', async () => {
    const mem = memoryStore()
    const engine = engineWith(mem)
    await expect(engine.maintenance.setExpiry({ enabled: true, grace_days: 99 }, null)).rejects.toThrow()
    await mem.store.settings.set('expiry', { enabled: 'yes' }, null)
    expect(await engine.maintenance.getExpiry()).toEqual({ enabled: true, grace_days: 0 })
  })
})

describe('review preview uses the same price columns as publishing', () => {
  it('formats free, paid and unknown prices like the AlbaGo row', () => {
    expect(albagoPriceFields({ state: 'free', min: null, max: null, currency: null, note: null })).toEqual({ price: 'Free', price_from_cents: 0, price_currency: 'EUR' })
    expect(albagoPriceFields({ state: 'paid', min: 1500, max: null, currency: 'ALL', note: null })).toMatchObject({ price_from_cents: 150000, price_currency: 'ALL' })
    expect(albagoPriceFields({ state: 'unknown', min: null, max: null, currency: null, note: null }).price).toBeNull()
  })
})
