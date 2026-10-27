import { describe, expect, it } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import type { EngineDeps, RelevanceCriteriaV1 } from '@/engine'
import { createEngine, isDue, PAUSE_AFTER_ERRORS, type MonitorOptions } from '@/engine/server'
import { memoryStore } from './memoryStore'

// The monitoring lane with no network and no AI: the "websites" are HTML
// strings served by a fake fetcher, and their programmes carry JSON-LD, so a
// model that throws proves no AI call is made.
let clock = new Date('2026-10-04T07:00:00Z')
const HOUR = 3_600_000

const albanian: RelevanceCriteriaV1 = {
  id: 'albanian',
  description: 'Albanian-relevant',
  affiliation: 'albanian',
  keywords: ['shqip', 'albanian'],
  location_implies: { country_codes: ['AL', 'XK'], localities: [] },
  signals: { title_keyword: 'strong' },
  rule: { min_strong: 1, or_min_medium: 2 },
}

const hemingway = { '@type': 'Place', name: 'Hemingway Bar', address: { addressLocality: 'Tiranë', addressCountry: 'AL' } }
const event = (name: string, startDate: string) => ({ '@type': 'MusicEvent', name, startDate, location: hemingway })
const programme = (events: object[]) => `<html><head><title>Programme</title><script type="application/ld+json">${JSON.stringify(events)}</script></head><body>Programme</body></html>`

function setup(pages: Record<string, string | null>) {
  const mem = memoryStore()
  const neverCalled = new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error('AI must not be called on JSON-LD programmes')
    },
  })
  const deps: EngineDeps = {
    store: mem.store,
    now: () => clock,
    reasoner: { id: 'test/none', agent: neverCalled, extractor: neverCalled },
    search: { id: 'none', search: async () => [] },
    fetcher: { fetchHtml: async (url) => (pages[url] ? { url, finalUrl: url, status: 200, contentType: 'text/html', html: pages[url]! } : null) },
  }
  return { mem, engine: createEngine(deps), pages }
}

async function addSource(engine: ReturnType<typeof createEngine>, mem: ReturnType<typeof memoryStore>, url: string) {
  const id = await mem.store.sources.propose({ connector: 'website_html', url, normalized_url: url, label: new URL(url).host, scope: {}, discovered_by_run: null, evaluation: { proposed_because: 'Venue programme' } })
  return id
}

const options = (extra: Partial<MonitorOptions> = {}): MonitorOptions => ({ criteria: albanian, horizonDays: 60, maxSources: 8, timeBudgetMs: 60_000, recheckDays: 14, triggeredBy: null, ...extra })

describe('known websites — the monitoring lane', () => {
  it('only approved sites are read; a visit brings in their events and fills the scorecard', async () => {
    clock = new Date('2026-10-04T07:00:00Z')
    const { mem, engine } = setup({ 'https://venue.al/program': programme([event('Jazz Night', '2026-10-10T21:00:00+02:00'), event('Blues Night', '2026-10-11T21:00:00+02:00')]) })
    const id = await addSource(engine, mem, 'https://venue.al/program')

    // Proposed only: nothing is read.
    expect((await engine.sources.monitor(options())).visits).toEqual([])

    await engine.sources.decide(id, 'approve', 'admin-1')
    const source = mem.sources.get(id)!
    expect(source).toMatchObject({ status: 'active', check_interval_hours: 72 })
    expect(isDue(source, clock.getTime())).toBe(true)

    const report = await engine.sources.monitor(options())
    expect(report.visits).toEqual([expect.objectContaining({ id, result: 'events', new: 2 })])
    expect(mem.occurrences.size).toBe(2)
    // Every observation points back at the source; no search was spent.
    expect([...mem.observations.values()].every((o) => o.source_id === id && o.connector === 'monitor')).toBe(true)
    expect(mem.runs.get(report.runId)).toMatchObject({ lane: 'monitoring', status: 'completed', stats: expect.objectContaining({ sources: 1, new: 2 }) })

    const card = (await engine.sources.overview())[0]
    expect(card.card).toMatchObject({ visits: 1, events_found: 2, relevant_found: 2, errors_in_row: 0 })
    expect(card.due).toBe(false)
    expect(card.last_status).toBe('ok')
  })

  it('an unchanged page costs nothing; after the recheck period its items are read again without duplicates', async () => {
    clock = new Date('2026-10-04T07:00:00Z')
    const { mem, engine } = setup({ 'https://venue.al/program': programme([event('Jazz Night', '2026-10-10T21:00:00+02:00'), event('Winter Gala', '2026-12-20T21:00:00+01:00')]) })
    const id = await addSource(engine, mem, 'https://venue.al/program')
    await engine.sources.decide(id, 'approve', null)
    await engine.sources.monitor(options())
    expect(mem.occurrences.size).toBe(1) // the gala is beyond the 60-day window

    clock = new Date(clock.getTime() + 73 * HOUR)
    const second = await engine.sources.monitor(options())
    expect(second.visits[0]).toMatchObject({ result: 'unchanged', new: 0 })

    // Two weeks on the gala is inside the window: the full re-read picks it up, the jazz night stays one event.
    clock = new Date('2026-10-25T07:00:00Z')
    const third = await engine.sources.monitor(options())
    expect(third.visits[0]).toMatchObject({ result: 'events', new: 1 })
    expect([...mem.occurrences.values()].map((o) => o.title).sort()).toEqual(['Jazz Night', 'Winter Gala'])
  })

  it('a site that keeps failing pauses itself with the reason', async () => {
    clock = new Date('2026-10-04T07:00:00Z')
    const { mem, engine } = setup({})
    const id = await addSource(engine, mem, 'https://down.example/events')
    await engine.sources.decide(id, 'approve', null)
    for (let i = 0; i < PAUSE_AFTER_ERRORS; i++) {
      const report = await engine.sources.monitor(options())
      expect(report.visits[0].result).toBe('error')
      clock = new Date(clock.getTime() + 73 * HOUR)
    }
    const source = mem.sources.get(id)!
    expect(source.status).toBe('paused')
    expect(source.status_reason).toContain('5 failed reads in a row')
    expect(source.last_status).toBe('error')

    // Approving again gives it a fresh start.
    await engine.sources.decide(id, 'approve', null)
    expect(mem.sources.get(id)!.evaluation.errors_in_row).toBe(0)
  })

  it('reads the most overdue sites first and stops at the per-run limit', async () => {
    clock = new Date('2026-10-04T07:00:00Z')
    const pages: Record<string, string> = {}
    for (const n of [1, 2, 3]) pages[`https://venue${n}.al/program`] = programme([event(`Night ${n}`, '2026-10-10T21:00:00+02:00')])
    const { mem, engine } = setup(pages)
    for (const url of Object.keys(pages)) await engine.sources.decide(await addSource(engine, mem, url), 'approve', null)
    const report = await engine.sources.monitor(options({ maxSources: 2 }))
    expect(report.visits).toHaveLength(2)
    const next = await engine.sources.monitor(options({ maxSources: 2 }))
    expect(next.visits.map((v) => v.label)).toEqual(['venue3.al'])
  })

  it('test reads a page and saves nothing; events the engine already has show as known', async () => {
    clock = new Date('2026-10-04T07:00:00Z')
    const page = programme([event('Albanian Night', '2026-10-10T21:00:00+02:00'), event('Blues Night', '2026-10-11T21:00:00+02:00')])
    const { mem, engine } = setup({ 'https://venue.al/program': page, 'https://venue.al/e/blues': programme([event('Blues Night', '2026-10-11T21:00:00+02:00')]) })
    // The engine already knows the blues night from another page.
    await engine.observePage({ input: { connector: 'test', source_id: null, source_url: 'https://other.al/blues', retrieved_at: clock.toISOString(), evidence: { title: 'Blues', text_excerpt: null, jsonld: [event('Blues Night', '2026-10-11T21:00:00+02:00')], meta: {}, media: [] }, lead: null, run_id: null } }, { criteria: albanian })
    const before = { obs: mem.observations.size, occ: mem.occurrences.size, runs: mem.runs.size }

    const preview = await engine.sources.preview('https://venue.al/program', albanian, 60)

    expect(preview).toMatchObject({ ok: true, kind: 'list' })
    if (!preview.ok) throw new Error('unreachable')
    expect(preview.events.map((e) => [e.title, e.known, e.relevance])).toEqual([
      ['Albanian Night', false, 'relevant'],
      ['Blues Night', true, 'relevant'],
    ])
    expect({ obs: mem.observations.size, occ: mem.occurrences.size, runs: mem.runs.size }).toEqual(before)
    expect(await engine.sources.preview('https://nowhere.example/', albanian, 60)).toEqual({ ok: false, reason: 'unreadable' })
  })

  it('counts the events of each source a human verified', async () => {
    clock = new Date('2026-10-04T07:00:00Z')
    const { mem, engine } = setup({ 'https://venue.al/program': programme([event('Jazz Night', '2026-10-10T21:00:00+02:00'), event('Blues Night', '2026-10-11T21:00:00+02:00')]) })
    const id = await addSource(engine, mem, 'https://venue.al/program')
    await engine.sources.decide(id, 'approve', null)
    await engine.sources.monitor(options())
    const [first] = [...mem.occurrences.values()]
    await engine.review.verify(first.id, {}, 'reviewer')
    expect((await engine.sources.overview())[0].verified).toBe(1)
  })

  it('a one-country site supplies the country only when an event names neither country nor city', async () => {
    // Shaped like letsgo.al: rows give the venue but never say "Albania".
    clock = new Date('2026-10-04T07:00:00Z')
    const square = { '@type': 'Place', name: 'Sheshi Skënderbej' }
    const prishtina = { '@type': 'Place', name: 'Palace of Youth', address: { addressLocality: 'Prishtinë' } }
    const brno = { '@type': 'Place', name: 'Fléda', address: { addressLocality: 'Brno' } }
    const { mem, engine } = setup({
      'https://tickets.al/events': programme([
        { '@type': 'MusicEvent', name: 'Food Fest', startDate: '2026-10-10T18:00:00+02:00', location: square },
        { '@type': 'MusicEvent', name: 'Rock Night', startDate: '2026-10-11T20:00:00+02:00', location: prishtina },
        { '@type': 'MusicEvent', name: 'Tour Stop', startDate: '2026-10-12T20:00:00+02:00', location: brno },
      ]),
    })
    const id = await mem.store.sources.propose({ connector: 'website_html', url: 'https://tickets.al/events', normalized_url: 'https://tickets.al/events', label: 'tickets.al', scope: { country_codes: ['AL'], localities: ['Tirana'] }, discovered_by_run: null, evaluation: {} })
    await engine.sources.decide(id, 'approve', null)
    // 2 of the 3 events name a city, so the JSON-LD is used as it is (no AI).
    await engine.sources.monitor(options())

    const byTitle = Object.fromEntries([...mem.occurrences.values()].map((o) => [o.title, o]))
    expect(byTitle['Food Fest'].location.country_code).toBe('AL')
    expect(byTitle['Food Fest'].provenance.country_code.status).toBe('derived')
    expect(byTitle['Food Fest'].relevance.albanian.verdict).toBe('relevant')
    expect(byTitle['Rock Night'].location).toMatchObject({ locality: 'Prishtina', country_code: 'XK' }) // the city wins
    // A city the engine doesn't know: no country is guessed, and it isn't Albanian.
    expect(byTitle['Tour Stop']).toBeUndefined()
  })

  it('check interval is 6 hours to 30 days', async () => {
    const { mem, engine } = setup({})
    const id = await addSource(engine, mem, 'https://venue.al/program')
    await engine.sources.setInterval(id, 24)
    expect(mem.sources.get(id)!.check_interval_hours).toBe(24)
    await expect(engine.sources.setInterval(id, 1)).rejects.toThrow()
  })
})
