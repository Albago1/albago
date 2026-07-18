import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, MapPin } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'

// Cities index (audit §30) — the destination behind the "Cities" nav item.
// Each card links to the /city/[slug] landing page from §25.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Cities — where AlbaGo is live',
  description:
    'Browse events city by city — across Albania and the Albanian diaspora. Tirana, Prishtina, Berlin and more.',
  alternates: { canonical: '/cities' },
  openGraph: {
    title: 'Cities — AlbaGo',
    description:
      'Browse events city by city — across Albania and the Albanian diaspora.',
    type: 'website',
  },
}

type CityRow = { slug: string; name: string }

export default async function CitiesPage() {
  const supabase = await createClient()
  const [citiesRes, eventsRes] = await Promise.all([
    supabase.from('cities').select('slug, name').order('name'),
    supabase
      .from('events')
      .select(
        'location_slug, date, end_date, time, end_time, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
      )
      .eq('status', 'published')
      .or(activeEventsOrFilter()),
  ])

  // 'unknown' is the ingestion fallback for unresolved locations, not a real
  // city — never show it as a destination (audit ALB-002).
  const cities = ((citiesRes.data as CityRow[] | null) ?? []).filter(
    (c) => c.slug !== 'unknown',
  )
  const activeEvents = ((eventsRes.data as Array<
    { location_slug: string } & Parameters<typeof isEventActive>[0]
  > | null) ?? []).filter(isEventActive)

  const counts = new Map<string, number>()
  for (const e of activeEvents) {
    counts.set(e.location_slug, (counts.get(e.location_slug) ?? 0) + 1)
  }

  const sorted = [...cities].sort((a, b) => {
    const diff = (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0)
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-10 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0 bg-radial-flame" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-flame-500/15 px-3 py-1 text-xs font-semibold text-flame-300 ring-1 ring-flame-500/40">
            <MapPin className="h-3.5 w-3.5" />
            Cities
          </p>
          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            Pick your <span className="italic text-flame-400">city</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">
            Events, nightlife and civic gatherings, city by city — across
            Albania and the Albanian diaspora.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((city) => {
            const count = counts.get(city.slug) ?? 0
            return (
              <Link
                key={city.slug}
                href={`/city/${city.slug}`}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-flame-500/30 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="display-text text-2xl text-white">
                    {city.name}
                  </h2>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-flame-400" />
                </div>
                {count > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-flame-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-flame-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flame-500" />
                    </span>
                    {count} upcoming {count === 1 ? 'event' : 'events'}
                  </p>
                )}
              </Link>
            )
          })}
        </div>

        {cities.length === 0 && (
          <p className="mx-auto max-w-4xl text-center text-sm text-white/50">
            Cities are loading — try again in a moment.
          </p>
        )}
      </section>
    </main>
  )
}
