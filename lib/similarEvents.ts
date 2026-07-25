import { createClient } from '@/lib/supabase/server'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'
import { nextOccurrence } from '@/lib/recurrence'

// The shape a similar-event card needs. Mirrors the columns we fetch below.
export type SimilarEvent = {
  id: string
  slug: string
  title: string
  category: string
  date: string
  end_date: string | null
  time: string
  end_time: string | null
  location_slug: string
  country: string | null
  banner_url: string | null
  gallery_urls: string[] | null
  price: string | null
  price_from_cents: number | null
  price_currency: string | null
  highlight: boolean | null
  tags: string[] | null
  is_civic: boolean | null
  organizer_id: string | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
}

type Seed = {
  id: string
  category: string
  location_slug: string
  country: string | null
  tags: string[] | null
  isCivic: boolean
  organizerId: string | null
}

const SELECT =
  'id, slug, title, category, date, end_date, time, end_time, location_slug, country, banner_url, gallery_urls, price, price_from_cents, price_currency, highlight, tags, is_civic, organizer_id, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions'

// How many cards the rail shows at most.
const MAX_RESULTS = 8

function daysUntil(iso: string | null): number {
  if (!iso) return 999
  const then = new Date(`${iso}T12:00:00`).getTime()
  const now = Date.now()
  return Math.max(0, Math.round((then - now) / 86_400_000))
}

// Higher = more similar / more worth surfacing first.
function score(seed: Seed, cand: SimilarEvent): number {
  let s = 0

  if (cand.category === seed.category) s += 50

  if (cand.location_slug === seed.location_slug) s += 40
  else if (cand.country && seed.country && cand.country === seed.country) s += 15

  const seedTags = new Set((seed.tags ?? []).map((t) => t.toLowerCase()))
  if (seedTags.size > 0 && cand.tags) {
    const shared = cand.tags.filter((t) => seedTags.has(t.toLowerCase())).length
    s += Math.min(shared * 8, 24)
  }

  if (seed.organizerId && cand.organizer_id === seed.organizerId) s += 12
  if (cand.highlight) s += 6

  // Soonness — nudge events happening sooner above distant ones, but only as a
  // tiebreaker so it never overrides a strong category/city match.
  const d = daysUntil(nextOccurrence(cand) ?? cand.date)
  s += Math.max(0, 10 - d / 3)

  return s
}

/**
 * Ranked "you might also like" events for a given event. Only published,
 * still-active events in the same civic/non-civic bucket, current event
 * excluded. Strongest matches (same category + city) first; broadens to the
 * same country to keep the rail full.
 */
export async function fetchSimilarEvents(seed: Seed): Promise<SimilarEvent[]> {
  const supabase = await createClient()

  // Two cheap queries in parallel: strong signal (same category OR city) plus
  // a same-country filler. `.eq('country', …)` is used for the filler because
  // country values can contain spaces that would break `.or()` filter syntax.
  const strong = supabase
    .from('events')
    .select(SELECT)
    .eq('status', 'published')
    .neq('id', seed.id)
    .or(`category.eq.${seed.category},location_slug.eq.${seed.location_slug}`)
    .or(activeEventsOrFilter())
    .order('date', { ascending: true })
    .limit(48)

  const filler = seed.country
    ? supabase
        .from('events')
        .select(SELECT)
        .eq('status', 'published')
        .neq('id', seed.id)
        .eq('country', seed.country)
        .or(activeEventsOrFilter())
        .order('date', { ascending: true })
        .limit(24)
    : Promise.resolve({ data: [] as SimilarEvent[] })

  const [strongRes, fillerRes] = await Promise.all([strong, filler])

  const pool = new Map<string, SimilarEvent>()
  for (const row of [
    ...((strongRes.data as SimilarEvent[] | null) ?? []),
    ...((fillerRes.data as SimilarEvent[] | null) ?? []),
  ]) {
    if (!pool.has(row.id)) pool.set(row.id, row)
  }

  return Array.from(pool.values())
    .filter((e) => !!e.is_civic === seed.isCivic)
    .filter((e) => isEventActive(e))
    .map((e) => ({ e, s: score(seed, e) }))
    .sort((a, b) => (b.s !== a.s ? b.s - a.s : a.e.date < b.e.date ? -1 : 1))
    .slice(0, MAX_RESULTS)
    .map(({ e }) => e)
}
