'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock3,
  Flame,
  MapPin,
  Search,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { isThisWeekend, isToday, getTodayDateString } from '@/lib/dateFilters'
import { createClient } from '@/lib/supabase/browser'
import { getLocationBySlug, locations } from '@/lib/locations'
import { useSearchParams } from 'next/navigation'

type TimeFilter = 'all' | 'tonight' | 'weekend'

type PublicEvent = {
  id: string
  title: string
  slug: string
  place_id: string | null
  category: string
  description: string
  date: string
  time: string
  price: string | null
  highlight: boolean | null
  status: string
  location_slug: string
  country: string
  region: string | null
}

const timeFilters: TimeFilter[] = ['all', 'tonight', 'weekend']

function formatEventDateLabel(dateString: string) {
  const eventDate = new Date(`${dateString}T12:00:00`)
  const today = new Date(`${getTodayDateString()}T12:00:00`)

  const diffInMs = eventDate.getTime() - today.getTime()
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) return 'Tonight'
  if (diffInDays === 1) return 'Tomorrow'

  return eventDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getTimeFilterLabel(filter: TimeFilter) {
  if (filter === 'all') return 'All'
  if (filter === 'tonight') return 'Tonight'
  return 'This Weekend'
}

function getCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'

  const value = category.toLowerCase()

  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'

  return 'bg-white/10 text-white/80'
}

function sortEventsByPriority(list: PublicEvent[]) {
  return [...list].sort((a, b) => {
    if (Boolean(a.highlight) !== Boolean(b.highlight)) {
      return a.highlight ? -1 : 1
    }

    const aDateTime = new Date(`${a.date}T${a.time}`)
    const bDateTime = new Date(`${b.date}T${b.time}`)

    return aDateTime.getTime() - bDateTime.getTime()
  })
}

function getEventMapHref(event: PublicEvent) {
  const timeParam = isToday(event.date)
    ? 'time=tonight'
    : isThisWeekend(event.date)
      ? 'time=weekend'
      : ''

  if (event.place_id) {
    return timeParam
      ? `/map?place=${event.place_id}&${timeParam}`
      : `/map?place=${event.place_id}`
  }

  return timeParam ? `/map?${timeParam}` : '/map'
}
function buildMapHref(event: PublicEvent, query: string) {
  const params = new URLSearchParams()

  params.set('location', event.location_slug)

  if (event.place_id) {
    params.set('place', event.place_id)
  }

  if (query.trim()) {
    params.set('q', query.trim())
  }

  if (isToday(event.date)) {
    params.set('time', 'tonight')
  } else if (isThisWeekend(event.date)) {
    params.set('time', 'weekend')
  }

  return `/map?${params.toString()}`
}
export default function EventsPage() {
  return (
    <Suspense>
      <EventsContent />
    </Suspense>
  )
}

function EventsContent() {
  const { t } = useLanguage()
  const supabase = createClient()
  const searchParams = useSearchParams()

  const initialLocation = getLocationBySlug(searchParams.get('location'))
  const initialSearchQuery = searchParams.get('q') || ''

  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('all')
  const [activeLocationSlug, setActiveLocationSlug] = useState(initialLocation.slug)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .eq('location_slug', activeLocationSlug)
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      setIsLoading(false)

      if (error) {
        setErrorMessage(error.message)
        return
      }

      setEvents(data || [])
    }

    fetchEvents()
  }, [supabase, activeLocationSlug])

const filteredEvents = useMemo(() => {
  const normalizedSearch = searchQuery.trim().toLowerCase()

  return events.filter((event) => {
    const timeMatches =
      activeTimeFilter === 'all' ||
      (activeTimeFilter === 'tonight' && isToday(event.date)) ||
      (activeTimeFilter === 'weekend' && isThisWeekend(event.date))

    const searchMatches =
      normalizedSearch.length === 0 ||
      event.title.toLowerCase().includes(normalizedSearch) ||
      event.description.toLowerCase().includes(normalizedSearch) ||
      event.category.toLowerCase().includes(normalizedSearch)

    return timeMatches && searchMatches
  })
}, [activeTimeFilter, events, searchQuery])

  const sortedEvents = useMemo(
    () => sortEventsByPriority(filteredEvents),
    [filteredEvents]
  )

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-12 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute right-[18%] top-28 h-[22rem] w-[22rem] rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
            <MapPin className="h-4 w-4" />
            {getLocationBySlug(activeLocationSlug).label},{' '}
            {getLocationBySlug(activeLocationSlug).country}
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            All events in {getLocationBySlug(activeLocationSlug).label}
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            Browse what’s happening now, then jump straight into the map when
            you want location context.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/map?location=${activeLocationSlug}`}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.35)] transition hover:bg-blue-500"
            >
              <MapPin className="h-4 w-4" />
              {t('open_map')}
            </Link>

            <Link
              href={`/map?location=${activeLocationSlug}&time=tonight`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.06] hover:text-white"
            >
              <Flame className="h-4 w-4" />
              {t('tonight')}
            </Link>
          </div>
          <div className="mt-6">
            <label className="text-sm font-medium text-white/60">
              Location
            </label>

            <select
              value={activeLocationSlug}
              onChange={(event) => setActiveLocationSlug(event.target.value)}
              className="mt-2 h-12 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1020] px-4 text-sm text-white outline-none"
            >
              {locations.map((location) => (
                <option key={location.slug} value={location.slug}>
                  {location.label} · {location.country}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 max-w-sm">
            <label className="text-sm font-medium text-white/60">
              Search
            </label>

            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search events, music, food..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0b1020] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {timeFilters.map((filter) => {
              const isActive = activeTimeFilter === filter

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveTimeFilter(filter)}
                  className={[
                    'rounded-full px-4 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-white text-black'
                      : 'border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white',
                  ].join(' ')}
                >
                  {getTimeFilterLabel(filter)}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/75">
              <span className="font-semibold text-white">{sortedEvents.length}</span>{' '}
              {sortedEvents.length === 1 ? 'event' : 'events'}
            </div>
          </div>

          {isLoading && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-white/60">
              Loading events...
            </div>
          )}

          {errorMessage && (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
              {errorMessage}
            </div>
          )}

          {!isLoading && !errorMessage && sortedEvents.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center backdrop-blur-md">
              <p className="text-base font-semibold text-white">
                No events match this filter yet
              </p>
              <p className="mt-2 text-sm text-white/55">
                Try another time filter or jump into the map to explore places.
              </p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {sortedEvents.map((event) => (
              <Link
                key={event.id}
                href={buildMapHref(event, searchQuery)}
                className="group block rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getCategoryTone(
                        event.category
                      )}`}
                    >
                      {event.category}
                    </span>

                    {event.price && (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/80">
                        {event.price}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {event.highlight && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                        Hot
                      </span>
                    )}

                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/70">
                      {formatEventDateLabel(event.date)}
                    </span>
                  </div>
                </div>

                <h2 className="mt-4 text-xl font-semibold leading-tight text-white">
                  {event.title}
                </h2>

                <div className="mt-2 flex items-center gap-2 text-sm text-white/55">
                  <MapPin className="h-4 w-4" />
                  <span>{event.place_id ? 'Linked venue' : 'Venue pending'}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/60">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{event.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    <span>{event.time}</span>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-white/65">
                  {event.description}
                </p>

                <div className="mt-5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 transition group-hover:text-blue-300">
                    Open in map
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}