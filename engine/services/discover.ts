import { generateText, jsonSchema, stepCountIs, tool } from 'ai'
import type { DiscoveryGoalV1 } from '../contract/goal'
import { normalizeImportUrl, sourceNameFromUrl } from '../core/url'
import { distillPage, type DistilledPage } from '../extract/page'
import type { EngineDeps } from '../ports'
import { observe, type ObserveOutcome } from './observe'

/**
 * AI Discovery Agent — the research lane. Given a goal (configuration, not
 * code), the model searches, reads pages, and submits event pages to the
 * engine's normal intake. AI researches and reasons; the engine controls:
 * every limit and guard lives in the tools, not in the prompt.
 *
 * - A search result is a LEAD. Only a page the engine fetched itself can be
 *   submitted, and `observe` re-reads that evidence with its own checks.
 * - Budgets (searches, page reads, minutes) are enforced per tool call.
 * - Hosts the deployment marks as not collectable are refused by the tool.
 */

export type DiscoverOptions = {
  triggeredBy: string | null
  /** Hostnames the research lane must not fetch (e.g. platforms without permission). */
  blockedHosts?: string[]
  /** Hard cap on agent steps (each tool call is a step). */
  maxSteps?: number
}

export type DiscoverReport = {
  runId: string
  status: 'completed' | 'failed' | 'stopped_budget'
  window: { from: string; to: string }
  stats: Record<string, number>
  outcomes: Array<ObserveOutcome & { url: string }>
  proposedSources: string[]
  summary: string
  error: string | null
}

const EVENTISH_LINK = /(event|events|evente|eventi|ngjarje|koncert|concert|festival|party|tickets?|bileta|program|agenda|kalendar|calendar|shows?|shfaqje|activity|aktivitet)/i

function eventLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const out = new Set<string>()
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base)
      if (u.host !== base.host || u.protocol !== base.protocol) continue
      if (u.pathname === base.pathname || u.pathname.length < 3) continue
      if (!EVENTISH_LINK.test(u.pathname)) continue
      out.add(u.toString())
    } catch {
      // ignore malformed hrefs
    }
    if (out.size >= 25) break
  }
  return [...out]
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function describeGoal(goal: DiscoveryGoalV1, window: { from: string; to: string }): string {
  const where =
    'scope' in goal.geography
      ? 'anywhere in the world'
      : `${goal.geography.localities.length ? goal.geography.localities.join(', ') + ' — ' : ''}countries ${goal.geography.country_codes.join(', ')}`
  const lines = [
    `Goal: ${goal.label}`,
    `Where: ${where}`,
    `When: events taking place between ${window.from} and ${window.to} (inclusive)`,
    goal.categories?.length ? `Event types of interest: ${goal.categories.join(', ')}` : 'Event types: all kinds',
    goal.relevance ? `Audience relevance: ${goal.relevance.description}` : null,
    goal.languages.length ? `Search in these languages too: ${goal.languages.join(', ')}` : null,
  ]
  if (goal.expansion) {
    const e = goal.expansion
    if (e.places.length) lines.push(`Places to cover: ${e.places.map((p) => `${p.country_code}${p.cities.length ? ` (${p.cities.join(', ')})` : ''}`).join('; ')}`)
    if (e.entities.performers.length) lines.push(`Known performers to check for upcoming dates: ${e.entities.performers.join(', ')}`)
    if (e.entities.organizers.length) lines.push(`Known organizers/promoters: ${e.entities.organizers.join(', ')}`)
    if (e.platforms.length) lines.push(`Platforms worth searching within: ${e.platforms.join(', ')}`)
  }
  return lines.filter(Boolean).join('\n')
}

const SYSTEM = `You are an event researcher. You find real, upcoming events that match a goal, using web search and by reading pages. You hand each event page you find to the engine with submit_event; the engine verifies and stores it.

How to work:
1. Plan several different searches: vary the language (local language first), the event type, the venue or organizer names you learn, and the dates ("this weekend", month names). Do not repeat a query.
2. Prefer primary sources: venue, organizer, festival and ticketing pages. Aggregators and news roundups are good for finding names and links, then go to the primary page.
3. ALWAYS read_page before submit_event. Submit only pages that announce ONE specific event with a date inside the goal window. A listing/agenda page is for finding links to individual event pages — use the links read_page returns.
4. Submit each distinct event page once. Results marked known:true are already in the engine — skip them unless you are checking for changes.
5. When a website regularly lists many relevant events (a venue program, a ticketing category, an events calendar), call propose_source once with a short reason.
6. Never invent events, dates or URLs. If a tool says the budget is exhausted, stop and write your summary.
7. Finish with a short plain summary: what you searched, how many events you submitted, and gaps you could not cover.`

export async function discover(deps: EngineDeps, goal: DiscoveryGoalV1, opts: DiscoverOptions): Promise<DiscoverReport> {
  const now = deps.now?.() ?? new Date()
  const today = now.toISOString().slice(0, 10)
  const window = { from: today, to: addDays(today, goal.horizon_days) }
  const startedAt = Date.now()
  const deadline = startedAt + goal.budget.max_minutes * 60_000
  const blocked = new Set((opts.blockedHosts ?? []).map((h) => h.toLowerCase().replace(/^www\./, '')))

  const stats = { searches: 0, pages_read: 0, submitted: 0, new: 0, attached: 0, possible_duplicate: 0, unchanged: 0, not_event: 0, past: 0, outside_window: 0, failed: 0, refused: 0, sources_proposed: 0, input_tokens: 0, output_tokens: 0 }
  const log: Array<Record<string, unknown>> = []
  const outcomes: Array<ObserveOutcome & { url: string }> = []
  const proposedSources: string[] = []
  const pages = new Map<string, { page: DistilledPage; finalUrl: string; retrievedAt: string; query: string | null }>()
  let lastQuery: string | null = null

  const runId = await deps.store.runs.create('research', { goal, window }, opts.triggeredBy)
  const overBudget = (kind: 'search' | 'fetch') => {
    if (Date.now() > deadline) return 'time budget exhausted — stop and summarise'
    if (kind === 'search' && stats.searches >= goal.budget.max_searches) return 'search budget exhausted — stop searching'
    if (kind === 'fetch' && stats.pages_read >= goal.budget.max_fetches) return 'page budget exhausted — stop reading'
    return null
  }
  const isBlocked = (url: string) => {
    const host = sourceNameFromUrl(url)
    return !host || [...blocked].some((b) => host === b || host.endsWith(`.${b}`))
  }

  const tools = {
    web_search: tool({
      description: 'Search the web. Returns result titles, URLs and snippets. known:true means the engine already has that page.',
      inputSchema: jsonSchema<{ query: string }>({
        type: 'object',
        properties: { query: { type: 'string', description: 'The search query.' } },
        required: ['query'],
        additionalProperties: false,
      }),
      execute: async ({ query }: { query: string }) => {
        const stop = overBudget('search')
        if (stop) return { error: stop }
        stats.searches++
        lastQuery = query
        try {
          const results = await deps.search.search(query, { maxResults: 8, recencyDays: Math.max(goal.horizon_days, 30) })
          const rows = await Promise.all(
            results.map(async (r) => {
              const key = normalizeImportUrl(r.url)
              const known = key ? (await deps.store.observations.countRecentForUrl(key)) > 0 : false
              return { url: r.url, title: r.title.slice(0, 160), snippet: r.snippet.slice(0, 300), known, blocked: isBlocked(r.url) }
            }),
          )
          log.push({ t: 'search', query, results: rows.length })
          return { results: rows }
        } catch (error) {
          log.push({ t: 'search_error', query, error: String(error).slice(0, 200) })
          return { error: 'search failed' }
        }
      },
    }),

    read_page: tool({
      description: 'Fetch and read one web page. Returns its title, the start of its text, whether it has structured event data, and links that look like event pages on the same site.',
      inputSchema: jsonSchema<{ url: string }>({
        type: 'object',
        properties: { url: { type: 'string', description: 'Absolute http(s) URL.' } },
        required: ['url'],
        additionalProperties: false,
      }),
      execute: async ({ url }: { url: string }) => {
        const stop = overBudget('fetch')
        if (stop) return { error: stop }
        if (isBlocked(url)) {
          stats.refused++
          return { error: 'this site is not collected by this deployment — do not use it' }
        }
        stats.pages_read++
        const fetched = await deps.fetcher.fetchHtml(url)
        if (!fetched) {
          log.push({ t: 'read_failed', url })
          return { error: 'could not read this page (blocked, not HTML, or offline)' }
        }
        const page = distillPage(fetched.html, fetched.finalUrl)
        pages.set(url, { page, finalUrl: fetched.finalUrl, retrievedAt: new Date().toISOString(), query: lastQuery })
        log.push({ t: 'read', url })
        return {
          title: page.title,
          has_structured_event_data: page.jsonld.some((b) => JSON.stringify(b).includes('Event')),
          text_start: page.text.slice(0, 2500),
          event_links: eventLinks(fetched.html, fetched.finalUrl).slice(0, 20),
        }
      },
    }),

    submit_event: tool({
      description: 'Hand ONE event page you have already read to the engine for verification. Returns what the engine decided.',
      inputSchema: jsonSchema<{ url: string }>({
        type: 'object',
        properties: { url: { type: 'string', description: 'The URL you passed to read_page.' } },
        required: ['url'],
        additionalProperties: false,
      }),
      execute: async ({ url }: { url: string }) => {
        const read = pages.get(url)
        if (!read) return { error: 'read_page this URL first' }
        stats.submitted++
        const outcome = await observe(
          deps,
          {
            connector: 'research_agent',
            source_id: null,
            source_url: read.finalUrl,
            retrieved_at: read.retrievedAt,
            evidence: {
              title: read.page.title,
              text_excerpt: read.page.text,
              jsonld: read.page.jsonld.slice(0, 50),
              meta: read.page.description ? { description: read.page.description } : {},
              media: read.page.imageUrl ? [{ url: read.page.imageUrl, role: 'poster', rights: 'unknown' }] : [],
            },
            lead: { query: read.query, snippet: null },
            run_id: runId,
          },
          { criteria: goal.relevance, window },
        )
        stats[outcome.outcome]++
        outcomes.push({ ...outcome, url: read.finalUrl })
        log.push({ t: 'submit', url: read.finalUrl, outcome: outcome.outcome, title: outcome.title, date: outcome.start_date })
        return { outcome: outcome.outcome, title: outcome.title, start_date: outcome.start_date, issues: outcome.issues.slice(0, 5) }
      },
    }),

    propose_source: tool({
      description: 'Suggest a website that regularly lists many relevant events, so the engine can monitor it later (a human approves it first).',
      inputSchema: jsonSchema<{ url: string; why: string }>({
        type: 'object',
        properties: { url: { type: 'string' }, why: { type: 'string', description: 'One short sentence.' } },
        required: ['url', 'why'],
        additionalProperties: false,
      }),
      execute: async ({ url, why }: { url: string; why: string }) => {
        const key = normalizeImportUrl(url)
        if (!key || isBlocked(url)) return { error: 'not a usable source URL' }
        const existing = await deps.store.sources.findByNormalizedUrl(key)
        if (existing) return { ok: true, note: `already registered (${existing.status})` }
        await deps.store.sources.propose({
          connector: 'website_html',
          url,
          normalized_url: key,
          label: sourceNameFromUrl(url),
          scope: 'scope' in goal.geography ? {} : { country_codes: goal.geography.country_codes, localities: goal.geography.localities },
          discovered_by_run: runId,
          evaluation: { proposed_because: why.slice(0, 300), goal: goal.id },
        })
        stats.sources_proposed++
        proposedSources.push(url)
        return { ok: true }
      },
    }),
  }

  let summary = ''
  let status: DiscoverReport['status'] = 'completed'
  let error: string | null = null
  try {
    const result = await generateText({
      model: deps.reasoner.agent,
      system: SYSTEM,
      prompt: `${describeGoal(goal, window)}\n\nToday is ${today}. Budget: ${goal.budget.max_searches} searches, ${goal.budget.max_fetches} page reads, ${goal.budget.max_minutes} minutes. Begin.`,
      tools,
      stopWhen: stepCountIs(opts.maxSteps ?? goal.budget.max_searches + goal.budget.max_fetches + 10),
      temperature: 0.2,
      // Hard stop: the budget must hold even if a provider call hangs or waits on a rate limit.
      abortSignal: AbortSignal.timeout(Math.max(deadline - Date.now(), 10_000) + 30_000),
    })
    summary = result.text
    stats.input_tokens = result.totalUsage?.inputTokens ?? result.usage.inputTokens ?? 0
    stats.output_tokens = result.totalUsage?.outputTokens ?? result.usage.outputTokens ?? 0
    if (stats.searches >= goal.budget.max_searches || stats.pages_read >= goal.budget.max_fetches || Date.now() > deadline) {
      status = 'stopped_budget'
    }
  } catch (e) {
    status = 'failed'
    error = e instanceof Error ? e.message.slice(0, 500) : 'discovery_failed'
  }

  await deps.store.runs.finish(runId, { status, stats, log: log.slice(0, 500), error })
  return { runId, status, window, stats, outcomes, proposedSources, summary, error }
}
