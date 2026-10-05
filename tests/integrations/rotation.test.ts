import { describe, expect, it } from 'vitest'
import { DiscoveryGoalV1 } from '@/engine'
import { ARTIST_SEED, DIASPORA_CITIES, REGION_CITIES, cityGoal, artistGoal, worldwideGoal } from '@/integrations/albago/goals'
import { ARTISTS_PER_RUN, freeTierLimits, pickNext, planRotation, usage, type RunInfo } from '@/integrations/albago/rotation'

const NOW = Date.UTC(2026, 9, 20, 12)
const DAY = 86_400_000
const run = (goalId: string, daysAgo: number, extra: Partial<RunInfo> = {}): RunInfo => ({ goalId, performers: [], startedAt: NOW - daysAgo * DAY, status: 'completed', searches: 5, ...extra })

describe('AlbaGo goals', () => {
  it('every city and the artist batches are valid engine goals', () => {
    for (const c of [...REGION_CITIES, ...DIASPORA_CITIES]) expect(() => DiscoveryGoalV1.parse(cityGoal(c))).not.toThrow()
    expect(() => DiscoveryGoalV1.parse(artistGoal(ARTIST_SEED.slice(0, 4)))).not.toThrow()
    expect(() => DiscoveryGoalV1.parse(worldwideGoal())).not.toThrow()
    expect(new Set([...REGION_CITIES, ...DIASPORA_CITIES].map((c) => cityGoal(c).id)).size).toBe(REGION_CITIES.length + DIASPORA_CITIES.length)
  })

  it('fits one 300 s function: deadline + 30 s abort margin stays under 5 minutes', () => {
    expect(cityGoal(REGION_CITIES[0]).budget.max_minutes * 60 + 30).toBeLessThan(290)
  })
})

describe('rotation', () => {
  it('starts with never-run targets, worldwide then region first, then the most overdue', () => {
    const plan = planRotation(['Noizy'], [], NOW)
    expect(pickNext(plan)?.id).toBe('worldwide')
    expect(pickNext(planRotation(['Noizy'], [run('worldwide', 1)], NOW))?.id).toBe('city-tirana')
    const runs = [run('worldwide', 1), ...[...REGION_CITIES, ...DIASPORA_CITIES].map((c, i) => run(cityGoal(c).id, 1 + (i % 3)))]
    // Every city ran in the last 3 days; the never-searched artist is now most due.
    expect(pickNext(planRotation(['Noizy'], runs, NOW))?.id).toBe('artists')
  })

  it('returns nothing when everything was covered recently (saves the free quota)', () => {
    const runs = [run('worldwide', 0.5), ...[...REGION_CITIES, ...DIASPORA_CITIES].map((c) => run(cityGoal(c).id, 0.5))]
    runs.push(run('artists', 1, { performers: ['Noizy'] }))
    expect(pickNext(planRotation(['Noizy'], runs, NOW))).toBeNull()
  })

  it('worldwide is due every 3 days', () => {
    expect(planRotation([], [run('worldwide', 3.5)], NOW).find((p) => p.id === 'worldwide')!.due).toBeGreaterThan(1)
    expect(planRotation([], [run('worldwide', 2)], NOW).find((p) => p.id === 'worldwide')!.due).toBeLessThan(1)
  })

  it('Tirana is due after 4 days, other region cities after 7', () => {
    const plan = planRotation([], [run('city-tirana', 5), run('city-durres', 5)], NOW)
    expect(plan.find((p) => p.id === 'city-tirana')!.due).toBeGreaterThan(1)
    expect(plan.find((p) => p.id === 'city-durres')!.due).toBeLessThan(1)
  })

  it('a failed run before any search does not count as covered', () => {
    const plan = planRotation([], [run('city-tirana', 0.1, { status: 'failed', searches: 0 })], NOW)
    expect(plan.find((p) => p.id === 'city-tirana')!.lastRun).toBeNull()
  })

  it('artist batches take the most overdue artists, tracked per artist', () => {
    const artists = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']
    const runs = [run('artists', 40, { performers: ['A1', 'A2'] }), run('artists', 2, { performers: ['A3', 'A4', 'A5'] })]
    const entry = planRotation(artists, runs, NOW).find((p) => p.id === 'artists')!
    expect(entry.goal.expansion?.entities.performers).toEqual(['A6', 'A1', 'A2', 'A3'].slice(0, ARTISTS_PER_RUN))
  })
})

describe('free-tier gate', () => {
  it('counts searches this month and runs today; ignores runs stuck as running', () => {
    const runs = [run('city-tirana', 0.1), run('city-durres', 0.2), run('city-vlore', 25), run('city-x', 0.003, { status: 'running', searches: 0 })] // started ~4 min ago
    // The run 25 days ago (20 Oct → 25 Sep) was last month.
    expect(usage(runs, NOW)).toEqual({ monthSearches: 10, todayRuns: 3, running: true })
    expect(usage([run('city-x', 1, { status: 'running' })], NOW).running).toBe(false)
    expect(freeTierLimits({}).monthlySearches).toBeLessThan(1000)
  })
})
