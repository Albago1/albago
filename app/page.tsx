import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'
import HomeClient, { type HomeStats } from './HomeClient'

// ISR: the page stays statically served but re-computes the stat counters
// periodically, so the server HTML that crawlers / no-JS visitors receive
// carries real inventory numbers instead of the CountUp's zero starting
// state (audit ALB-001).
export const revalidate = 1800

export const metadata: Metadata = {
  title: 'AlbaGo — Discover Events, Movements & Nightlife',
  description:
    'Discover events, nightlife and civic gatherings across Albania and the Albanian diaspora. Search any city — Tirana, Prishtina, Berlin, New York, London — and join what matters tonight.',
  openGraph: {
    title: 'AlbaGo — Discover Events, Movements & Nightlife',
    description:
      'Discover events, nightlife and civic gatherings across Albania and the Albanian diaspora. Starting in Albania and Albanian communities worldwide, with more cities coming next.',
    siteName: 'AlbaGo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AlbaGo — Events, Movements & Nightlife',
    description:
      'Discover events, nightlife and civic gatherings across Albania and the Albanian diaspora.',
  },
}

/**
 * Server-side twin of HomeClient's live stat derivation: same wire filter,
 * same isEventActive refinement, same distinct-set counting. Cookie-less anon
 * client keeps the route static + ISR. Fail-safe: on any error return null —
 * HomeClient then renders nothing misleading and the client fetch takes over.
 */
async function fetchHomeStats(): Promise<HomeStats | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase
      .from('events')
      .select(
        'location_slug, place_id, date, end_date, time, end_time, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
      )
      .eq('status', 'published')
      .or(activeEventsOrFilter())
    if (error || !data) return null

    const active = (data as Array<
      { location_slug: string | null; place_id: string | null } & Parameters<
        typeof isEventActive
      >[0]
    >).filter(isEventActive)

    return {
      events: active.length,
      cities: new Set(active.map((e) => e.location_slug).filter(Boolean)).size,
      places: new Set(active.map((e) => e.place_id).filter(Boolean)).size,
    }
  } catch {
    return null
  }
}

export default async function HomePage() {
  const initialStats = await fetchHomeStats()
  return <HomeClient initialStats={initialStats} />
}
