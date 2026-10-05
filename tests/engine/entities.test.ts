import { describe, expect, it } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import type { DiscoveryGoalV1, EngineDeps, RelevanceCriteriaV1 } from '@/engine'
import { cleanEntityName, createEngine } from '@/engine/server'
import { memoryStore } from './memoryStore'

const NOW = new Date('2026-10-04T12:00:00Z')

const CRITERIA: RelevanceCriteriaV1 = {
  id: 'albanian',
  description: 'Albanian-relevant',
  affiliation: 'albanian',
  keywords: ['albanian', 'shqip'],
  location_implies: { country_codes: ['AL', 'XK'], localities: [] },
  signals: { performer_affiliation: 'strong' },
  rule: { min_strong: 1, or_min_medium: 2 },
}

function page(name: string, performer: string, city: string, country: string) {
  return `<html><head><title>${name}</title><script type="application/ld+json">${JSON.stringify({
    '@type': 'MusicEvent',
    name,
    startDate: '2026-10-20T21:00:00+02:00',
    performer: { '@type': 'Person', name: performer },
    location: { '@type': 'Place', name: 'Hall', address: { addressLocality: city, addressCountry: country } },
  })}</script></head><body><p>${name} with ${performer}, ${city}</p></body></html>`
}

const PAGES: Record<string, string> = {
  'https://tickets.example/tirana': page('Noizy live', 'Noizy', 'Tiranë', 'AL'),
  'https://tickets.example/zurich': page('Albanian Night Zurich', 'Noizy', 'Zürich', 'CH'),
}

function scripted(steps: Array<Array<{ tool: string; input: Record<string, unknown> }> | string>) {
  let i = 0
  const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const step = steps[Math.min(i++, steps.length - 1)]
      if (typeof step === 'string') return { content: [{ type: 'text', text: step }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }
      return {
        content: step.map((c, n) => ({ type: 'tool-call' as const, toolCallId: `c${i}-${n}`, toolName: c.tool, input: JSON.stringify(c.input) })),
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
        usage,
        warnings: [],
      }
    },
  })
}

function deps(store: EngineDeps['store'], agent: MockLanguageModelV4): EngineDeps {
  return {
    store,
    now: () => NOW,
    reasoner: { id: 'test', agent, extractor: agent },
    search: { id: 'fake', search: async () => [] },
    fetcher: { fetchHtml: async (url) => (PAGES[url] ? { url, finalUrl: url, status: 200, contentType: 'text/html', html: PAGES[url] } : null) },
  }
}

const goal = (): DiscoveryGoalV1 => ({
  id: 'learn-test',
  label: 'Learning test',
  geography: { scope: 'worldwide' },
  horizon_days: 60,
  relevance: CRITERIA,
  languages: [],
  required_fields: [],
  budget: { max_searches: 2, max_fetches: 4, max_tokens: 10_000, max_minutes: 1 },
})

describe('entity knowledge', () => {
  it('drops junk names the extractor sometimes lists as performers', () => {
    expect(cleanEntityName('  Noizy ')).toBe('Noizy')
    expect(['DJ', 'Special Guests', 'TBA', '@club', 'https://x.al', '2026', 'a'].map(cleanEntityName)).toEqual([null, null, null, null, null, null, null])
  })

  it('seeds are confirmed once, idempotently, and never override a human rejection', async () => {
    const mem = memoryStore()
    const engine = createEngine(deps(mem.store, scripted(['done'])))
    expect(await engine.entities.ensureAffiliated('performer', ['Noizy', 'Elvana Gjata', 'DJ'], 'albanian')).toBe(2)
    expect(await engine.entities.ensureAffiliated('performer', ['noizy', 'Elvana Gjata'], 'albanian')).toBe(0)
    const noizy = [...mem.entities.values()].find((e) => e.name === 'Noizy')!
    await engine.entities.decide(noizy.id, 'albanian', 'rejected', 'reviewer')
    expect(await engine.entities.ensureAffiliated('performer', ['Noizy'], 'albanian')).toBe(0)
    expect(await engine.entities.affiliated('performer', 'albanian')).toEqual(['Elvana Gjata'])
  })

  it('learns performers of relevant events as candidates; a confirmed one makes a diaspora concert relevant', async () => {
    const mem = memoryStore()
    // Run 1: an event in Tirana (relevant by location) teaches the engine "Noizy".
    const run1 = scripted([[{ tool: 'read_page', input: { url: 'https://tickets.example/tirana' } }], [{ tool: 'submit_event', input: { url: 'https://tickets.example/tirana' } }], 'done'])
    const engine1 = createEngine(deps(mem.store, run1))
    const r1 = await engine1.discover(goal(), { triggeredBy: null })
    expect(r1.stats.entities_proposed).toBe(1)
    const candidates = await engine1.entities.candidates('performer', 'albanian')
    expect(candidates.map((c) => c.name)).toEqual(['Noizy'])
    expect(candidates[0].affiliations.albanian.evidence?.[0].title).toBe('Noizy live')

    // Not confirmed yet: candidates are not relevance evidence.
    expect(await mem.store.entities.findAffiliated(['Noizy'], 'albanian')).toEqual([])

    // A reviewer confirms → the Zurich concert is Albanian-relevant through the performer.
    await engine1.entities.decide(candidates[0].id, 'albanian', 'confirmed', 'reviewer')
    const run2 = scripted([[{ tool: 'read_page', input: { url: 'https://tickets.example/zurich' } }], [{ tool: 'submit_event', input: { url: 'https://tickets.example/zurich' } }], 'done'])
    const engine2 = createEngine(deps(mem.store, run2))
    const r2 = await engine2.discover(goal(), { triggeredBy: null })
    expect(r2.outcomes[0].outcome).toBe('new')
    const zurich = await mem.store.occurrences.get(r2.outcomes[0].occurrenceId!)
    expect(zurich?.location.locality).toBe('Zurich')
    expect(zurich?.relevance.albanian?.verdict).toBe('relevant')
    expect(r2.stats.entities_proposed).toBe(0) // already decided
  })
})
