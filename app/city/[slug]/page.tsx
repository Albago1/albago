import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Moon,
  PartyPopper,
  Plus,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'
import {
  dateRangeShort,
  hasOccurrenceInRange,
  isMultiDay,
  nextOccurrence,
} from '@/lib/recurrence'
import { getTodayDateString, getWeekendDateStrings } from '@/lib/dateFilters'

// Indexable city landing pages (audit §25): /city/tirana, /city/berlin, …
// Server-rendered, ISR-refreshed, listed in the sitemap. Deep-links into the
// existing /events filters rather than duplicating them.
export const revalidate = 3600

type CityRow = { slug: string; name: string }

type CityEvent = {
  id: string
  slug: string
  title: string
  category: string
  date: string
  end_date: string | null
  time: string
  end_time: string | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
}

async function fetchCity(slug: string): Promise<CityRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cities')
    .select('slug, name')
    .eq('slug', slug)
    .maybeSingle()
  return (data as CityRow | null) ?? null
}

async function fetchCityData(slug: string) {
  const supabase = await createClient()
  const [eventsRes, venuesRes] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id, slug, title, category, date, end_date, time, end_time, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
      )
      .eq('status', 'published')
      .eq('location_slug', slug)
      .or(activeEventsOrFilter())
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(100),
    supabase
      .from('places')
      .select('slug, name')
      .eq('location_slug', slug)
      .limit(6),
  ])
  const events = ((eventsRes.data as CityEvent[] | null) ?? []).filter(
    isEventActive,
  )
  const venues = (venuesRes.data as Array<{ slug: string; name: string }> | null) ?? []
  return { events, venues }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const city = await fetchCity(slug)
  if (!city) return { title: 'City not found' }
  return {
    title: `Events in ${city.name} — tonight, this weekend & upcoming`,
    description: `What's happening in ${city.name}: events, nightlife and civic gatherings, updated live. Part of AlbaGo — across Albania and the Albanian diaspora.`,
    alternates: { canonical: `/city/${city.slug}` },
    openGraph: {
      title: `Events in ${city.name} — AlbaGo`,
      description: `Tonight, this weekend and upcoming events in ${city.name}.`,
      type: 'website',
    },
  }
}

function eventDateLabel(e: CityEvent): string {
  if (isMultiDay(e) && e.end_date) return dateRangeShort(e.date, e.end_date)
  const iso = nextOccurrence(e) ?? e.date
  const d = new Date(`${iso}T12:00:00`)
  const label = d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const time = e.time ? ` · ${e.time.slice(0, 5)}` : ''
  return `${label}${time}`
}

function EventRow({ event }: { event: CityEvent }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-flame-500/25 hover:bg-white/[0.06]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">
          {event.title}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-white/55">
          {eventDateLabel(event)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
        {event.category}
      </span>
    </Link>
  )
}

function Section({
  icon: Icon,
  title,
  events,
  moreHref,
  moreLabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  events: CityEvent[]
  moreHref: string
  moreLabel: string
}) {
  if (events.length === 0) return null
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </h2>
        <Link
          href={moreHref}
          className="text-xs font-semibold text-flame-300 transition hover:text-flame-200"
        >
          {moreLabel}
        </Link>
      </div>
      <div className="mt-4 space-y-2">
        {events.slice(0, 6).map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </div>
    </section>
  )
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const city = await fetchCity(slug)
  if (!city) notFound()

  const { events, venues } = await fetchCityData(city.slug)

  const today = getTodayDateString()
  const weekendDates = getWeekendDateStrings()
  const weekendFrom = weekendDates[0] ?? today
  const weekendTo = weekendDates[weekendDates.length - 1] ?? weekendFrom

  const tonight = events.filter((e) => nextOccurrence(e) === today)
  const weekend = events.filter(
    (e) =>
      hasOccurrenceInRange(e, weekendFrom, weekendTo) &&
      nextOccurrence(e) !== today,
  )
  const tonightIds = new Set(tonight.map((e) => e.id))
  const weekendIds = new Set(weekend.map((e) => e.id))
  const upcoming = events.filter(
    (e) => !tonightIds.has(e.id) && !weekendIds.has(e.id),
  )

  const categoryCounts = new Map<string, number>()
  for (const e of events) {
    const c = e.category?.toLowerCase()
    if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1)
  }
  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-10 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0 bg-radial-flame" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-flame-500/15 px-3 py-1 text-xs font-semibold text-flame-300 ring-1 ring-flame-500/40">
            <MapPin className="h-3.5 w-3.5" />
            City guide
          </p>
          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            {city.name}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">
            What&apos;s happening in {city.name} — events, nightlife and civic
            gatherings, updated live.{' '}
            {events.length > 0
              ? `${events.length} upcoming ${events.length === 1 ? 'event' : 'events'} right now.`
              : 'New events land here as organizers publish them.'}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/events?location=${city.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400"
            >
              Browse all {city.name} events
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
            >
              <MapPin className="h-4 w-4" />
              Open the map
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-16">
        {topCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topCategories.map(([cat, count]) => (
              <Link
                key={cat}
                href={`/events?location=${city.slug}&category=${encodeURIComponent(cat)}`}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold capitalize text-white/75 transition hover:border-flame-500/30 hover:text-white"
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)} · {count}
              </Link>
            ))}
          </div>
        )}

        <Section
          icon={Moon}
          title="Tonight"
          events={tonight}
          moreHref={`/events?location=${city.slug}&time=tonight`}
          moreLabel="View all"
        />
        <Section
          icon={PartyPopper}
          title="This weekend"
          events={weekend}
          moreHref={`/events?location=${city.slug}&time=weekend`}
          moreLabel="View all"
        />
        <Section
          icon={CalendarDays}
          title="Upcoming"
          events={upcoming}
          moreHref={`/events?location=${city.slug}`}
          moreLabel="View all"
        />

        {events.length === 0 && (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-base font-semibold text-white">
              No upcoming events in {city.name} yet
            </p>
            <p className="mt-2 text-sm text-white/55">
              Explore other cities, open the map, or be the first to add one.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400"
              >
                Explore all events
              </Link>
              <Link
                href="/submit-event"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Submit an event
              </Link>
            </div>
          </div>
        )}

        {venues.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Venues in {city.name}
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {venues.map((v) => (
                <Link
                  key={v.slug}
                  href={`/places/${v.slug}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white transition hover:border-flame-500/25 hover:bg-white/[0.06]"
                >
                  {v.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 rounded-3xl border border-flame-500/25 bg-gradient-to-br from-flame-500/[0.08] to-transparent p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold text-white">
            Organizing something in {city.name}?
          </h2>
          <p className="mt-2 text-sm text-white/55">
            Free to publish. Trusted organizers post instantly.
          </p>
          <Link
            href="/submit-event"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] transition hover:bg-flame-400"
          >
            <Plus className="h-4 w-4" />
            Submit an event
          </Link>
        </div>
      </div>
    </main>
  )
}
