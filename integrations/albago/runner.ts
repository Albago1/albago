import type { DiscoverReport } from '@/engine/server'
import { ALBANIAN_RELEVANCE, ARTIST_SEED, BLOCKED_HOSTS } from './goals'
import { freeTierLimits, pickNext, planRotation, runInfo, usage, type PlanEntry, type Usage } from './rotation'
import { albagoEngine } from './wiring'

/**
 * AlbaGo's discovery runner — used by the admin buttons and the daily cron.
 * Every run goes through the same gate: one run at a time, a daily run cap
 * and a monthly search cap that keep the engine inside the free tiers.
 * Nothing here publishes: found events wait in review.
 */

const AFFILIATION = ALBANIAN_RELEVANCE.affiliation

export type RunOutcome =
  | { ran: true; goalId: string; label: string; report: DiscoverReport }
  | { ran: false; reason: 'search_key_missing' | 'another_run_in_progress' | 'daily_run_limit' | 'monthly_search_budget_used' | 'nothing_due' | 'unknown_goal' }

export type DiscoveryOverview = {
  usage: Usage
  limits: ReturnType<typeof freeTierLimits>
  searchConfigured: boolean
  plan: Array<Omit<PlanEntry, 'goal'>>
  artists: number
}

async function context() {
  const engine = albagoEngine()
  // The seed list is configuration: make sure it is in the engine (idempotent, one read when unchanged).
  await engine.entities.ensureAffiliated('performer', ARTIST_SEED, AFFILIATION, 'config')
  const [runs, artists] = await Promise.all([engine.runs.recent(400), engine.entities.affiliated('performer', AFFILIATION)])
  const infos = runs.map(runInfo)
  const now = Date.now()
  return { engine, infos, artists, now, usage: usage(infos, now), limits: freeTierLimits(process.env), plan: planRotation(artists, infos, now) }
}

export async function discoveryOverview(): Promise<DiscoveryOverview> {
  const c = await context()
  return {
    usage: c.usage,
    limits: c.limits,
    searchConfigured: Boolean(process.env.TAVILY_API_KEY),
    plan: c.plan.map((p) => ({ id: p.id, label: p.label, kind: p.kind, lastRun: p.lastRun, due: p.due })),
    artists: c.artists.length,
  }
}

/** Run one discovery: a specific target, or (default) the most overdue one. */
export async function runDiscovery(opts: { goalId?: string; triggeredBy: string | null }): Promise<RunOutcome> {
  if (!process.env.TAVILY_API_KEY) return { ran: false, reason: 'search_key_missing' }
  const c = await context()
  if (c.usage.running) return { ran: false, reason: 'another_run_in_progress' }
  if (c.usage.todayRuns >= c.limits.dailyRuns) return { ran: false, reason: 'daily_run_limit' }
  const searchesLeft = c.limits.monthlySearches - c.usage.monthSearches
  if (searchesLeft < 2) return { ran: false, reason: 'monthly_search_budget_used' }

  const entry = opts.goalId && opts.goalId !== 'next' ? c.plan.find((p) => p.id === opts.goalId) : pickNext(c.plan)
  if (!entry) return { ran: false, reason: opts.goalId && opts.goalId !== 'next' ? 'unknown_goal' : 'nothing_due' }

  const goal = { ...entry.goal, budget: { ...entry.goal.budget, max_searches: Math.min(entry.goal.budget.max_searches, searchesLeft) } }
  const report = await c.engine.discover(goal, { triggeredBy: opts.triggeredBy, blockedHosts: BLOCKED_HOSTS })
  return { ran: true, goalId: entry.id, label: entry.label, report }
}

/** Human decision on a learned artist. */
export async function decideArtist(id: string, decision: 'confirm' | 'reject', actor: string | null): Promise<void> {
  await albagoEngine().entities.decide(id, AFFILIATION, decision === 'confirm' ? 'confirmed' : 'rejected', actor)
}

export async function artistCandidates(limit = 40) {
  const rows = await albagoEngine().entities.candidates('performer', AFFILIATION)
  return rows.slice(0, limit).map((e) => ({ id: e.id, name: e.name, seenIn: (e.affiliations[AFFILIATION]?.evidence ?? []).map((ev) => ev.title).slice(0, 3) }))
}
