import { describe, expect, it } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import type { DiscoveryGoalV1, EngineDeps } from '@/engine'
import { createEngine } from '@/engine/server'
import { memoryStore } from './memoryStore'

// The research agent with a SCRIPTED model: each step returns the tool calls a
// (partly misbehaving) AI might make. The point is the engine's guards — they
// live in the tools, so they must hold whatever the model does.
const NOW = new Date('2026-10-04T12:00:00Z')

type Call = { tool: string; input: Record<string, unknown> }
function scriptedModel(steps: Array<Call[] | string>) {
  let i = 0
  const usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
  }
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const step = steps[Math.min(i++, steps.length - 1)]
      if (typeof step === 'string') {
        return { content: [{ type: 'text', text: step }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }
      }
      return {
        content: step.map((c, n) => ({ type: 'tool-call' as const, toolCallId: `c${i}-${n}`, toolName: c.tool, input: JSON.stringify(c.input) })),
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
        usage,
        warnings: [],
      }
    },
  })
}

const EVENT_PAGE = `<html><head><title>Jazz Night</title>
<script type="application/ld+json">${JSON.stringify({
  '@type': 'MusicEvent',
  name: 'Jazz Night at Hemingway',
  startDate: '2026-10-10T21:00:00+02:00',
  location: { '@type': 'Place', name: 'Hemingway Bar', address: { addressLocality: 'Tiranë', addressCountry: 'AL' } },
})}</script></head><body><p>Jazz Night — Sat 10 Oct, 21:00, Hemingway Bar, Tiranë</p><a href="/events/next">Next event</a></body></html>`

function goal(maxSearches: number): DiscoveryGoalV1 {
  return {
    id: 'test-tirana',
    label: 'Test goal',
    geography: { country_codes: ['AL'], localities: ['Tirana'] },
    horizon_days: 14,
    languages: [],
    required_fields: [],
    budget: { max_searches: maxSearches, max_fetches: 5, max_tokens: 10_000, max_minutes: 1 },
  }
}

function deps(store: EngineDeps['store'], agent: MockLanguageModelV4): EngineDeps {
  const neverCalled = new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error('extractor must not run on complete JSON-LD')
    },
  })
  return {
    store,
    now: () => NOW,
    reasoner: { id: 'test/scripted', agent, extractor: neverCalled },
    search: {
      id: 'fake',
      search: async (query) => [{ url: 'https://venue.al/e/jazz', title: `Result for ${query}`, snippet: 'Jazz Night 10 Oct' }],
    },
    fetcher: {
      fetchHtml: async (url) => (url.startsWith('https://venue.al/') ? { url, finalUrl: url, status: 200, contentType: 'text/html', html: EVENT_PAGE } : null),
    },
  }
}

describe('discover() — AI researches, the engine controls', () => {
  it('enforces budgets, blocked hosts and read-before-submit, then records the run', async () => {
    const mem = memoryStore()
    const agent = scriptedModel([
      [{ tool: 'web_search', input: { query: 'Tirana events this week' } }],
      [{ tool: 'web_search', input: { query: 'koncerte Tiranë tetor' } }], // over the 1-search budget
      [
        { tool: 'read_page', input: { url: 'https://www.instagram.com/someclub/' } }, // blocked host
        { tool: 'submit_event', input: { url: 'https://venue.al/e/never-read' } }, // not read first
      ],
      [{ tool: 'read_page', input: { url: 'https://venue.al/e/jazz' } }],
      [{ tool: 'submit_event', input: { url: 'https://venue.al/e/jazz' } }],
      [{ tool: 'propose_source', input: { url: 'https://venue.al/events', why: 'Venue program lists many events' } }],
      'Searched once, found one jazz night, proposed the venue program.',
    ])
    const engine = createEngine(deps(mem.store, agent))

    const report = await engine.discover(goal(1), { triggeredBy: null, blockedHosts: ['instagram.com'] })

    expect(report.status).toBe('stopped_budget') // the search budget was hit
    expect(report.stats).toMatchObject({ searches: 1, pages_read: 1, refused: 1, submitted: 1, new: 1, sources_proposed: 1 })
    expect(report.outcomes).toHaveLength(1)
    expect(report.outcomes[0]).toMatchObject({ outcome: 'new', title: 'Jazz Night at Hemingway', start_date: '2026-10-10' })
    expect(report.proposedSources).toEqual(['https://venue.al/events'])
    expect(report.summary).toContain('jazz night')

    // The occurrence went to review, with the search query kept as the lead.
    const occ = [...mem.occurrences.values()][0]
    expect(occ.review_status).toBe('needs_review')
    expect(occ.location).toMatchObject({ locality: 'Tirana', country_code: 'AL' })
    const obs = [...mem.observations.values()][0]
    expect(obs.lead).toEqual({ query: 'Tirana events this week', snippet: null })
    expect(obs.run_id).toBe(report.runId)

    const run = mem.runs.get(report.runId)!
    expect(run.status).toBe('stopped_budget')
    expect(run.finished_at).not.toBeNull()
  })

  it('makes the agent read before searching again, and keeps it off blocked platforms', async () => {
    const mem = memoryStore()
    const agent = scriptedModel([
      [{ tool: 'web_search', input: { query: 'Tirana events' } }],
      [{ tool: 'web_search', input: { query: 'Tirana concerts' } }], // refused: nothing read yet
      [{ tool: 'read_page', input: { url: 'https://venue.al/e/jazz' } }],
      [{ tool: 'web_search', input: { query: 'site:instagram.com tirana club' } }], // refused: blocked platform
      [{ tool: 'web_search', input: { query: 'Tirana concerts' } }], // allowed after a read
      'Done.',
    ])
    const engine = createEngine(deps(mem.store, agent))
    const report = await engine.discover(goal(5), { triggeredBy: null, blockedHosts: ['instagram.com'] })
    expect(report.stats).toMatchObject({ searches: 2, pages_read: 1, guard_refusals: 2 })
    expect(report.status).toBe('completed')
  })

  it('a failing model ends the run as failed instead of leaving it running', async () => {
    const mem = memoryStore()
    const broken = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('quota exceeded')
      },
    })
    const report = await createEngine(deps(mem.store, broken)).discover(goal(3), { triggeredBy: null })
    expect(report.status).toBe('failed')
    expect(report.error).toContain('quota exceeded')
    expect(mem.runs.get(report.runId)!.status).toBe('failed')
  })
})
