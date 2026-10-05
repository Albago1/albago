import type { DiscoveryGoalV1, RunRecord } from '@/engine'
import { artistGoal, cityGoal, cityGoalId, DIASPORA_CITIES, REGION_CITIES, worldwideGoal, type CityTarget } from './goals'

/**
 * Worldwide coverage on free tiers: many small discovery runs, one city or
 * one batch of artists at a time, always picking whatever is most overdue.
 * Pure — the runner feeds it the run history; tests feed it fixtures.
 */

const DAY = 24 * 60 * 60_000

/** How often each kind of target should be researched (days). */
export const INTERVAL_DAYS = { worldwide: 3, tirana: 4, region: 7, diaspora: 10, artist: 30 } as const
export const ARTISTS_PER_RUN = 4

export type RunInfo = {
  goalId: string | null
  performers: string[]
  startedAt: number
  status: RunRecord['status']
  searches: number
}

/** The parts of a stored run the rotation needs (run.goal is `{ goal, window }`). */
export function runInfo(r: RunRecord): RunInfo {
  const goal = (r.goal as { goal?: Partial<DiscoveryGoalV1> } | null)?.goal
  return {
    goalId: typeof goal?.id === 'string' ? goal.id : null,
    performers: goal?.expansion?.entities?.performers ?? [],
    startedAt: Date.parse(r.started_at),
    status: r.status,
    searches: Number(r.stats?.searches ?? 0),
  }
}

/** A run that actually covered its target (a failure before any search does not count). */
const covered = (r: RunInfo) => r.status !== 'running' && (r.status !== 'failed' || r.searches > 0)

export type Usage = { monthSearches: number; todayRuns: number; running: boolean }

export function usage(runs: RunInfo[], now: number): Usage {
  const d = new Date(now)
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return {
    monthSearches: runs.filter((r) => r.startedAt >= monthStart).reduce((n, r) => n + r.searches, 0),
    todayRuns: runs.filter((r) => r.startedAt >= dayStart).length,
    // A run still marked running after 8 minutes was killed with its function; ignore it.
    running: runs.some((r) => r.status === 'running' && now - r.startedAt < 8 * 60_000),
  }
}

export type PlanEntry = {
  id: string
  label: string
  kind: 'worldwide' | 'region' | 'diaspora' | 'artists'
  lastRun: number | null
  /** >= 1 means due; never-run targets are most due. */
  due: number
  goal: DiscoveryGoalV1
}

function cityInterval(c: CityTarget): number {
  if (c.kind === 'diaspora') return INTERVAL_DAYS.diaspora
  return c.name === 'Tirana' ? INTERVAL_DAYS.tirana : INTERVAL_DAYS.region
}

export function planRotation(artists: string[], runs: RunInfo[], now: number): PlanEntry[] {
  const done = runs.filter(covered)
  const lastFor = (pred: (r: RunInfo) => boolean) => done.filter(pred).reduce<number | null>((m, r) => (m == null || r.startedAt > m ? r.startedAt : m), null)
  // Never-run targets come first, in list order (worldwide, region, diaspora, artists).
  const dueScore = (last: number | null, intervalDays: number, order: number) => (last == null ? 1000 - order : (now - last) / (intervalDays * DAY))

  const cities = [...REGION_CITIES, ...DIASPORA_CITIES]
  const worldLast = lastFor((r) => r.goalId === 'worldwide')
  const entries: PlanEntry[] = [
    { id: 'worldwide', label: 'Worldwide (any city)', kind: 'worldwide', lastRun: worldLast, due: dueScore(worldLast, INTERVAL_DAYS.worldwide, -1), goal: worldwideGoal() },
  ]
  cities.forEach((c, i) => {
    const id = cityGoalId(c)
    const last = lastFor((r) => r.goalId === id)
    entries.push({ id, label: c.kind === 'diaspora' ? `${c.name} (Albanian scene)` : c.name, kind: c.kind, lastRun: last, due: dueScore(last, cityInterval(c), i), goal: cityGoal(c) })
  })

  // Artists: each one tracked on its own; a run takes the most overdue few.
  if (artists.length) {
    const scored = artists
      .map((name, i) => {
        const key = name.toLowerCase()
        const last = lastFor((r) => r.performers.some((p) => p.toLowerCase() === key))
        return { name, last, due: dueScore(last, INTERVAL_DAYS.artist, cities.length + i) }
      })
      .sort((a, b) => b.due - a.due)
    const batch = scored.slice(0, ARTISTS_PER_RUN)
    const oldest = batch.reduce<number | null>((m, a) => (a.last == null ? m : m == null || a.last < m ? a.last : m), null)
    entries.push({
      id: 'artists',
      label: `Artists: ${batch.map((a) => a.name).join(', ')}`,
      kind: 'artists',
      lastRun: batch.some((a) => a.last == null) ? null : oldest,
      due: batch[0].due,
      goal: artistGoal(batch.map((a) => a.name)),
    })
  }

  return entries.sort((a, b) => b.due - a.due)
}

/** The most overdue target, or null when everything was covered recently. */
export function pickNext(plan: PlanEntry[]): PlanEntry | null {
  return plan.find((p) => p.due >= 1) ?? null
}

/** Free-tier limits, overridable per deployment. */
export function freeTierLimits(env: Record<string, string | undefined> = {}) {
  return {
    /** Tavily free plan = 1,000 searches/month; keep a reserve for manual runs. */
    monthlySearches: Number(env.ENGINE_MONTHLY_SEARCHES || 900),
    /** Protects the free Gemini daily request quota (≈35 model calls per run). */
    dailyRuns: Number(env.ENGINE_DAILY_RUNS || 8),
  }
}
