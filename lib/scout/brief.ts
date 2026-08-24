/**
 * What the Scout goes looking for (Phase 39). Pure — no I/O, safe in tests.
 *
 * A "brief" is one search assignment: an AREA and a date window. An area is
 * deliberately free-form text rather than a city row, because the beat has to
 * express three different shapes of question:
 *
 *   - a city            → "events in Tirana"
 *   - a whole country   → "events anywhere in Albania"
 *   - a diaspora country → "Albanian community events in Germany"
 *
 * The last one is why `scope` exists. Searching "events in Germany" would return
 * German events; what AlbaGo wants is the Albanian community's own calendar
 * there, which is a different question and needs a different prompt.
 *
 * Kept as a code-level list plus an env override rather than another DB table:
 * the beat changes a few times a year, and a table would mean a migration, an
 * admin screen, and a second thing to keep in sync for no gain.
 */

export type ScoutScope =
  /** A place: search everything public happening there. */
  | 'local'
  /** A country with an Albanian community: search THAT community's events. */
  | 'diaspora'

export type ScoutBrief = {
  /** Free-form area label fed to the search: "Tirana, Albania", "Germany". */
  area: string
  scope: ScoutScope
  /** How many days ahead of today to search. */
  days: number
}

/**
 * The home beat: the country as a whole, then the cities that actually generate
 * listings. The nationwide brief catches what a city list would miss (festivals
 * in small towns, coastal summer events); the city briefs catch what a single
 * nationwide search would flatten into "top 10 things in Tirana".
 */
export const HOME_AREAS: string[] = [
  'Albania (anywhere in the country)',
  'Tirana, Albania',
  'Durrës, Albania',
  'Vlorë, Albania',
  'Sarandë, Albania',
  'Shkodër, Albania',
  'Korçë, Albania',
  'Berat, Albania',
  'Gjirokastër, Albania',
  'Kosovo (anywhere in the country)',
  'Prishtina, Kosovo',
  'Prizren, Kosovo',
  'North Macedonia (Albanian-majority areas: Tetovo, Gostivar, Skopje)',
]

/**
 * The diaspora beat, ordered by community size. These are searched as "the
 * Albanian community's events in X", not "events in X".
 */
export const DIASPORA_AREAS: string[] = [
  'Germany',
  'Switzerland',
  'Italy',
  'Greece',
  'United Kingdom',
  'United States',
  'Sweden',
  'Austria',
  'Belgium',
  'Netherlands',
  'France',
  'Canada',
  'Turkey',
  'Australia',
]

export const DEFAULT_DAYS = 21

/** Bound the window: a search for "events in the next 2 years" returns noise. */
export const MIN_DAYS = 1
export const MAX_DAYS = 90

/**
 * How many briefs one nightly run works through.
 *
 * The full beat is ~27 areas; searching all of them in one run would blow any
 * function timeout and cost a fortune in extraction. So the run takes a slice
 * and the slice ROTATES by day (see rotateBriefs) — the whole beat is covered
 * every few nights, with no stored cursor to drift or corrupt.
 */
export const DEFAULT_BRIEFS_PER_RUN = 5

export function clampDays(raw: unknown, fallback = DEFAULT_DAYS): number {
  const n = typeof raw === 'number' ? Math.round(raw) : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, n))
}

/**
 * Parse an area env var: a comma-separated list of area labels. Blank entries
 * are skipped rather than failing the run — a stray comma in an env var must
 * never stop the nightly job.
 */
export function parseAreasEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * The full beat, home first then diaspora. Overridable per half:
 *   SCOUT_AREAS          — replaces the home list
 *   SCOUT_DIASPORA_AREAS — replaces the diaspora list
 * Set either to "none" to switch that half off entirely.
 */
export function fullBeat(env?: { areas?: string; diaspora?: string }): ScoutBrief[] {
  const homeRaw = env?.areas?.trim().toLowerCase() === 'none' ? [] : parseAreasEnv(env?.areas)
  const diasporaRaw =
    env?.diaspora?.trim().toLowerCase() === 'none' ? [] : parseAreasEnv(env?.diaspora)

  const home = env?.areas?.trim() ? homeRaw : HOME_AREAS
  const diaspora = env?.diaspora?.trim() ? diasporaRaw : DIASPORA_AREAS

  return [
    ...home.map((area) => ({ area, scope: 'local' as const, days: DEFAULT_DAYS })),
    ...diaspora.map((area) => ({ area, scope: 'diaspora' as const, days: DEFAULT_DAYS })),
  ]
}

/**
 * Take `perRun` briefs starting at an offset derived from the day, wrapping
 * around the end of the list. Day-derived rather than stored, so it needs no
 * table, survives redeploys, and can't get stuck: every area comes up on a fixed
 * cycle no matter what happened on previous nights.
 */
export function rotateBriefs(
  briefs: ScoutBrief[],
  perRun: number,
  dayIndex: number,
): ScoutBrief[] {
  if (briefs.length === 0 || perRun <= 0) return []
  if (perRun >= briefs.length) return briefs
  const start = ((dayIndex % briefs.length) + briefs.length) % briefs.length
  const out: ScoutBrief[] = []
  for (let i = 0; i < perRun; i++) out.push(briefs[(start + i) % briefs.length])
  return out
}

/** Days since epoch — the rotation cursor. Same for every run on a given day. */
export function dayIndexFor(todayIso: string): number {
  const ms = new Date(`${todayIso}T00:00:00Z`).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : 0
}

/**
 * Build the briefs for one run.
 *  - an explicit `areas` list wins (the admin's "Search now")
 *  - otherwise the full beat, rotated to this day's slice
 */
export function buildBriefs(opts?: {
  areas?: string[]
  scope?: ScoutScope
  days?: number
  perRun?: number
  todayIso?: string
  env?: { areas?: string; diaspora?: string }
}): ScoutBrief[] {
  const days = clampDays(opts?.days)

  if (opts?.areas?.length) {
    return opts.areas
      .map((a) => a.trim())
      .filter(Boolean)
      .map((area) => ({ area, scope: opts.scope ?? 'local', days }))
  }

  const beat = fullBeat(opts?.env).map((b) => ({ ...b, days }))
  const perRun = opts?.perRun ?? DEFAULT_BRIEFS_PER_RUN
  const dayIndex = dayIndexFor(opts?.todayIso ?? new Date().toISOString().slice(0, 10))
  return rotateBriefs(beat, perRun, dayIndex)
}

/** ISO date `days` from `todayIso`. Stated explicitly in the prompt because
 *  "the next 21 days" is ambiguous to a model and two dates are not. */
export function windowEnd(todayIso: string, days: number): string {
  const d = new Date(`${todayIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
