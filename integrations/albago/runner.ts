import { DEFAULT_INTERVAL_HOURS, type DiscoverReport, type ExpirySettingsV1, type MonitorReport, type RunRecord, type SourceRecord, type SourceScorecard } from '@/engine/server'
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
  // Only research runs spend searches and count against the research caps.
  const infos = runs.filter((r) => r.lane === 'research').map(runInfo)
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

/**
 * Re-check Albanian relevance of every open suggestion with the current rules
 * and the current artist list (seed included). Human decisions are kept.
 */
export async function reassessRelevance() {
  const engine = albagoEngine()
  await engine.entities.ensureAffiliated('performer', ARTIST_SEED, AFFILIATION, 'config')
  return engine.maintenance.reassessRelevance(ALBANIAN_RELEVANCE)
}

/** Housekeeping: delete pending suggestions whose event is over (per the expiry setting). */
export async function expireEnded() {
  return albagoEngine().maintenance.expireEnded()
}

export async function engineSettings() {
  const m = albagoEngine().maintenance
  const [expiry, lastRun] = await Promise.all([m.getExpiry(), m.lastExpiryRun()])
  return { expiry, lastRun, cutoff: m.cutoffFor(expiry) }
}

/** Save the expiry setting and apply it right away, so the page reflects it at once. */
export async function saveExpiry(next: ExpirySettingsV1, actor: string | null) {
  const m = albagoEngine().maintenance
  const expiry = await m.setExpiry(next, actor)
  const run = await m.expireEnded()
  return { expiry, removed: run.removed, cutoff: run.cutoff }
}

/** Human decision on a learned artist. */
export async function decideArtist(id: string, decision: 'confirm' | 'reject', actor: string | null): Promise<void> {
  const engine = albagoEngine()
  await engine.entities.decide(id, AFFILIATION, decision === 'confirm' ? 'confirmed' : 'rejected', actor)
  // A confirmed artist makes their events Albanian-relevant right away.
  if (decision === 'confirm') await engine.maintenance.reassessRelevance(ALBANIAN_RELEVANCE)
}

// ---------------------------------------------------------------------------
// Known websites (monitoring lane): approved once, re-read on a schedule.
// No searches; each page costs at most two free AI calls, and an unchanged
// page or one with structured event data costs none.
// ---------------------------------------------------------------------------

/** How far ahead monitored pages are read; an unchanged page is re-read in full every 14 days. */
const MONITOR_HORIZON_DAYS = 120
const MONITOR_RECHECK_DAYS = 14

export function monitorLimits(env: Record<string, string | undefined> = {}) {
  return {
    /** Pages per day across the monitoring slots (protects the free Gemini quota). */
    dailyPages: Number(env.ENGINE_MONITOR_DAILY_PAGES || 24),
    /** Pages per run: fits one 300 s function with paced AI calls. */
    perRun: 8,
  }
}

function monitorUsage(runs: RunRecord[], now: number) {
  const d = new Date(now)
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const lane = runs.filter((r) => r.lane === 'monitoring')
  return {
    pagesToday: lane.filter((r) => Date.parse(r.started_at) >= dayStart).reduce((n, r) => n + Number(r.stats?.sources ?? 0), 0),
    // A run still marked running after 8 minutes was killed with its function; ignore it.
    running: lane.some((r) => r.status === 'running' && now - Date.parse(r.started_at) < 8 * 60_000),
  }
}

export type MonitorOutcome = { ran: true; report: MonitorReport } | { ran: false; reason: 'monitor_running' | 'daily_page_limit' | 'nothing_due' }

/** Re-read the most overdue approved websites (cron 3× a day, or the admin button). */
export async function runMonitoring(opts: { triggeredBy: string | null }): Promise<MonitorOutcome> {
  const engine = albagoEngine()
  const [runs, sources] = await Promise.all([engine.runs.recent(100), engine.sources.overview()])
  const usage = monitorUsage(runs, Date.now())
  const limits = monitorLimits(process.env)
  if (usage.running) return { ran: false, reason: 'monitor_running' }
  const left = limits.dailyPages - usage.pagesToday
  if (left <= 0) return { ran: false, reason: 'daily_page_limit' }
  if (!sources.some((s) => s.due)) return { ran: false, reason: 'nothing_due' }
  await engine.entities.ensureAffiliated('performer', ARTIST_SEED, AFFILIATION, 'config')
  const report = await engine.sources.monitor({
    criteria: ALBANIAN_RELEVANCE,
    horizonDays: MONITOR_HORIZON_DAYS,
    maxSources: Math.min(limits.perRun, left),
    timeBudgetMs: 200_000,
    recheckDays: MONITOR_RECHECK_DAYS,
    triggeredBy: opts.triggeredBy,
  })
  return { ran: true, report }
}

export type SourceRow = {
  id: string
  label: string
  url: string
  status: SourceRecord['status']
  statusReason: string | null
  why: string | null
  foundBy: string | null
  intervalHours: number
  lastChecked: string | null
  lastStatus: SourceRecord['last_status']
  lastError: string | null
  due: boolean
  card: SourceScorecard
  verified: number
}

export async function sourcesOverview() {
  const engine = albagoEngine()
  const [rows, runs] = await Promise.all([engine.sources.overview(), engine.runs.recent(100)])
  const sources: SourceRow[] = rows.map((s) => {
    const ev = s.evaluation as { proposed_because?: string; goal?: string }
    return {
      id: s.id,
      label: s.label ?? s.url,
      url: s.url,
      status: s.status,
      statusReason: s.status_reason,
      why: ev.proposed_because ?? null,
      foundBy: ev.goal ?? null,
      intervalHours: s.check_interval_hours ?? DEFAULT_INTERVAL_HOURS,
      lastChecked: s.last_checked_at,
      lastStatus: s.last_status,
      lastError: s.last_error,
      due: s.due,
      card: s.card,
      verified: s.verified,
    }
  })
  return { sources, limits: monitorLimits(process.env), usage: monitorUsage(runs, Date.now()) }
}

/** Read a page now and show what the engine would take from it. Nothing is saved. */
export function testSource(url: string) {
  return albagoEngine().sources.preview(url, ALBANIAN_RELEVANCE, MONITOR_HORIZON_DAYS)
}

export async function decideSource(id: string, decision: 'approve' | 'reject' | 'pause', actor: string | null, reason: string | null = null) {
  await albagoEngine().sources.decide(id, decision, actor, reason)
}

export async function setSourceInterval(id: string, hours: number) {
  await albagoEngine().sources.setInterval(id, hours)
}

export async function artistCandidates(limit = 40) {
  const rows = await albagoEngine().entities.candidates('performer', AFFILIATION)
  return rows.slice(0, limit).map((e) => ({ id: e.id, name: e.name, seenIn: (e.affiliations[AFFILIATION]?.evidence ?? []).map((ev) => ev.title).slice(0, 3) }))
}
