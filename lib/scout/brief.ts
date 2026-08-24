/**
 * What the Scout goes looking for (Phase 39). Pure — no I/O, safe in tests.
 *
 * A "brief" is one search assignment: a city and a date window. The nightly run
 * works through a list of them. Keeping this a plain list rather than another DB
 * table is deliberate — the source registry (crawl_sources) already exists for
 * the crawler, and a second admin-managed table for four city names would be
 * ceremony. Override without a deploy via the SCOUT_CITIES env var.
 */

export type ScoutBrief = {
  city: string
  country: string
  /** How many days ahead of today to search. */
  days: number
}

/**
 * The default beat. Small on purpose: every brief costs one grounded search plus
 * a verification read per event found, and a nightly job that quietly burns the
 * budget is worse than one that covers three cities well. Grow it once the yield
 * per city is known.
 */
export const DEFAULT_CITIES: Array<{ city: string; country: string }> = [
  { city: 'Tirana', country: 'Albania' },
  { city: 'Durrës', country: 'Albania' },
  { city: 'Prishtina', country: 'Kosovo' },
]

export const DEFAULT_DAYS = 21

/** Bound the window: a search for "events in the next 2 years" returns noise. */
export const MIN_DAYS = 1
export const MAX_DAYS = 90

export function clampDays(raw: unknown, fallback = DEFAULT_DAYS): number {
  const n = typeof raw === 'number' ? Math.round(raw) : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, n))
}

/**
 * Parse SCOUT_CITIES: a comma-separated list of `City:Country` pairs, e.g.
 * "Tirana:Albania, Vlorë:Albania, Prishtina:Kosovo". A bare "Tirana" defaults to
 * Albania. Malformed entries are skipped rather than failing the run — a typo in
 * an env var must never stop the nightly job.
 */
export function parseCitiesEnv(raw: string | undefined): Array<{ city: string; country: string }> {
  if (!raw?.trim()) return []
  const out: Array<{ city: string; country: string }> = []
  for (const part of raw.split(',')) {
    const [cityRaw, countryRaw] = part.split(':')
    const city = (cityRaw ?? '').trim()
    if (!city) continue
    out.push({ city, country: (countryRaw ?? '').trim() || 'Albania' })
  }
  return out
}

/** The brief list for a run: explicit cities, else the env override, else the default beat. */
export function buildBriefs(opts?: {
  cities?: Array<{ city: string; country: string }>
  days?: number
  citiesEnv?: string
}): ScoutBrief[] {
  const days = clampDays(opts?.days)
  const cities =
    opts?.cities?.length
      ? opts.cities
      : parseCitiesEnv(opts?.citiesEnv).length
        ? parseCitiesEnv(opts?.citiesEnv)
        : DEFAULT_CITIES
  return cities.map(({ city, country }) => ({ city, country, days }))
}

/** ISO date `days` from `todayIso`. Used to state the window explicitly in the
 *  prompt — "the next 21 days" is ambiguous to a model, two dates are not. */
export function windowEnd(todayIso: string, days: number): string {
  const d = new Date(`${todayIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
