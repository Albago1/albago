'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Flame,
  MapPin,
  Moon,
  Music2,
  ArrowRight,
  UtensilsCrossed,
  Trophy,
  Sparkles,
  Palette,
  Calendar,
  Clock3,
  BadgeCheck,
  Search,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { isThisWeekend, isToday } from '@/lib/dateFilters'
import { getLocationBySlug, locations } from '@/lib/locations'
import { useLocations } from '@/lib/useLocations'
import { createClient } from '@/lib/supabase/browser'
import type { Place } from '@/types/place'
import type { Event } from '@/types/event'

const categories = [
  { labelKey: 'category_nightlife', value: 'nightlife', icon: Moon },
  { labelKey: 'category_music', value: 'music', icon: Music2 },
  { labelKey: 'category_sports', value: 'sports', icon: Trophy },
  { labelKey: 'category_culture', value: 'culture', icon: Palette },
  { labelKey: 'category_food', value: 'food', icon: UtensilsCrossed },
]

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

function getPlaceCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'
  const value = category.toLowerCase()

  if (value === 'bar') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'club') return 'bg-violet-500/20 text-violet-300'
  if (value === 'restaurant') return 'bg-amber-500/20 text-amber-300'
  if (value === 'café' || value === 'cafe') return 'bg-sky-500/20 text-sky-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports' || value === 'sport') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'

  return 'bg-white/10 text-white/80'
}

function getEventMapHref(placeId: string | null, date: string) {
  const placeParam = placeId ? `place=${placeId}&` : ''
  if (isToday(date)) return `/map?${placeParam}time=tonight`
  if (isThisWeekend(date)) return `/map?${placeParam}time=weekend`
  return placeId ? `/map?place=${placeId}` : '/map'
}

function resolveLocationSlug(value: string) {
  if (value === 'current-location') return 'tirana'

  const normalized = value.trim().toLowerCase()

  const match = locations.find((location) => {
    return (
      location.slug.toLowerCase() === normalized ||
      location.label.toLowerCase() === normalized ||
      location.city?.toLowerCase() === normalized ||
      location.country.toLowerCase() === normalized
    )
  })

  return (
    match?.slug ??
    normalized.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  )
}

function buildSearchUrl(
  path: '/events' | '/map',
  locationInput: string,
  query: string
) {
  const params = new URLSearchParams()
  const locationSlug = resolveLocationSlug(locationInput)

  if (locationSlug) {
    params.set('location', locationSlug)
  }

  if (query.trim()) {
    params.set('q', query.trim())
  }

  return `${path}?${params.toString()}`
}

export default function HomePage() {
  const { t } = useLanguage()
  const locationOptions = useLocations()
  const [locationInput, setLocationInput] = useState('Tirana')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [activeLocationSlug, setActiveLocationSlug] = useState('tirana')
  const [isLocating, setIsLocating] = useState(false)
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([])
  const [featuredPlaces, setFeaturedPlaces] = useState<Place[]>([])
  const [allPlaces, setAllPlaces] = useState<Place[]>([])
  const [totalEventsCount, setTotalEventsCount] = useState(0)
  const [totalPlacesCount, setTotalPlacesCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function fetchFeatured() {
      const [placesRes, eventsRes, eventsCountRes, placesCountRes] = await Promise.all([
        supabase.from('places').select('*').eq('location_slug', activeLocationSlug),
        supabase
          .from('events')
          .select('*')
          .eq('status', 'published')
          .eq('location_slug', activeLocationSlug)
          .order('highlight', { ascending: false })
          .order('date', { ascending: true })
          .limit(6),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('places').select('*', { count: 'exact', head: true }),
      ])

      if (placesRes.data) {
        const mapped: Place[] = placesRes.data.map((p) => {
          const loc = getLocationBySlug(p.location_slug)
          return {
            id: p.id,
            name: p.name,
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            description: p.description,
            options: Array.isArray(p.options) ? p.options : [],
            imageUrl: p.image_url ?? undefined,
            city: loc ? `${loc.city ?? loc.label}, ${loc.country}` : p.country,
            address: p.address ?? undefined,
            websiteUrl: p.website_url ?? undefined,
            status: p.status ?? undefined,
          }
        })
        setAllPlaces(mapped)
        setFeaturedPlaces(mapped.slice(0, 6))
      }

      if (eventsRes.data) {
        setFeaturedEvents(eventsRes.data.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          time: e.time,
          placeId: e.place_id,
          description: e.description,
          category: e.category,
          price: e.price ?? undefined,
          highlight: e.highlight ?? undefined,
        })))
      }

      setTotalEventsCount(eventsCountRes.count ?? 0)
      setTotalPlacesCount(placesCountRes.count ?? 0)
    }

    fetchFeatured()
  }, [activeLocationSlug])

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        let nearest = locationOptions[0] ?? locations[0]
        let minDist = Infinity
        for (const loc of locationOptions) {
          const dist = Math.sqrt(
            Math.pow(loc.center[0] - longitude, 2) +
            Math.pow(loc.center[1] - latitude, 2)
          )
          if (dist < minDist) { minDist = dist; nearest = loc }
        }
        setLocationInput(nearest.label)
        setActiveLocationSlug(nearest.slug)
        setIsLocating(false)
        setIsLocationOpen(false)
      },
      () => {
        setIsLocating(false)
        setIsLocationOpen(false)
      },
      { timeout: 6000 }
    )
  }

  const matchingLocations = locationOptions.filter((location) => {
  const search = locationInput.toLowerCase()

  return (
    location.label.toLowerCase().includes(search) ||
    location.country.toLowerCase().includes(search) ||
    location.region?.toLowerCase().includes(search)
  )
})
  const resolvedLocation = getLocationBySlug(resolveLocationSlug(locationInput))

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-20 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-blue-600/12 blur-3xl" />
          <div className="absolute left-[58%] top-32 h-[26rem] w-[26rem] rounded-full bg-violet-600/12 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
            <Sparkles className="h-4 w-4" />
            Explore events by location
          </div>

          <h1 className="mt-8 max-w-5xl text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
            {t('hero_title')}
          </h1>

          <p className="mt-8 max-w-3xl text-lg leading-8 text-white/55 sm:text-2xl">
            {t('hero_subtitle')}
          </p>

          <div className="mt-10 w-full max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
            <div className="flex h-14 items-center gap-3 rounded-2xl bg-[#0b1020] px-4">
              <Search className="h-5 w-5 text-white/35" />

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search events, clubs, food..."
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/35"
              />
            </div>

            <div className="relative">
              <div className="flex h-14 items-center gap-3 rounded-2xl bg-[#0b1020] px-4">
                <MapPin className="h-5 w-5 text-white/35" />

                <input
                  value={locationInput}
                  onFocus={() => setIsLocationOpen(true)}
                  onChange={(event) => {
                    setLocationInput(event.target.value)
                    setIsLocationOpen(true)
                  }}
                  placeholder="Choose a location"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
                />
              </div>

              {isLocationOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] text-left shadow-2xl">
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isLocating}
                    className="flex w-full items-center gap-3 px-4 py-4 text-sm text-white/80 transition hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    <MapPin className="h-5 w-5 text-blue-400" />
                    <span>{isLocating ? 'Detecting...' : 'Use my current location'}</span>
                  </button>

                  <div className="border-t border-white/10" />

                  {matchingLocations.map((location) => (
                    <button
                      key={location.slug}
                      type="button"
                      onClick={() => {
                        setLocationInput(location.label)
                        setActiveLocationSlug(location.slug)
                        setIsLocationOpen(false)
                      }}
                      className="flex w-full items-start gap-3 px-4 py-4 text-sm transition hover:bg-white/[0.06]"
                    >
                      <MapPin className="mt-0.5 h-5 w-5 text-white/35" />

                      <span>
                        <span className="block font-semibold text-white">
                          {location.label}
                        </span>
                        <span className="block text-xs text-white/45">
                          {location.region ? `${location.region}, ` : ''}
                          {location.country}
                        </span>
                      </span>
                    </button>
                  ))}

                  {matchingLocations.length === 0 && (
                    <div className="px-4 py-4 text-sm text-white/45">
                      No saved location yet. Search will still continue.
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              href={buildSearchUrl('/events', locationInput, searchQuery)}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <Search className="h-5 w-5" />
              Search
            </Link>
          </div>

          <p className="mt-3 px-2 text-left text-sm text-white/45">
            Search by event, place, category, city, coast, or country.
          </p>
        </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {categories.map((category) => {
              const Icon = category.icon
              const locationSlug = resolveLocationSlug(locationInput)

              return (
                <Link
                  key={category.value}
                  href={`/events?location=${locationSlug}&category=${category.value}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-base text-white/80 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                  {t(category.labelKey)}
                </Link>
              )
            })}
          </div>

          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={buildSearchUrl('/events', locationInput, searchQuery)}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-10 py-5 text-xl font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.35)] transition hover:bg-blue-500"
            >
              <Calendar className="h-5 w-5" />
              Browse Events
            </Link>

            <Link
              href={buildSearchUrl('/map', locationInput, searchQuery)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-10 py-5 text-xl font-semibold text-white transition hover:bg-white/[0.04]"
            >
              <MapPin className="h-5 w-5" />
              {t('open_map')}
            </Link>

            <Link
              href={`/events?location=${resolveLocationSlug(
                locationInput
              )}&time=tonight`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-10 py-5 text-xl font-semibold text-white transition hover:bg-white/[0.04]"
            >
              <Flame className="h-5 w-5" />
              {t('tonight')}
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-white/45">Quick locations:</span>

            {locationOptions.map((location) => (
              <button
                key={location.slug}
                type="button"
                onClick={() => {
                  setLocationInput(location.label)
                  setActiveLocationSlug(location.slug)
                }}
                className={[
                  'rounded-full border px-4 py-2 text-sm transition',
                  resolvedLocation.slug === location.slug
                    ? 'border-blue-500/30 bg-blue-500/15 text-blue-300'
                    : 'border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.06] hover:text-white',
                ].join(' ')}
              >
                {location.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02] py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-4">
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-500">
              {totalPlacesCount}
            </div>
            <div className="mt-2 text-xl text-white/65">{t('venues')}</div>
          </div>

          <div className="text-center">
            <div className="text-5xl font-bold text-blue-500">
              {totalEventsCount}
            </div>
            <div className="mt-2 text-xl text-white/65">{t('events')}</div>
          </div>

          <div className="text-center">
            <div className="text-5xl font-bold text-blue-500">
              {locationOptions.length}
            </div>
            <div className="mt-2 text-xl text-white/65">{t('cities')}</div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  Featured Events
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  A quick look at what’s happening now
                </p>
              </div>
            </div>

            <Link
              href={buildSearchUrl('/events', locationInput, searchQuery)}
              className="hidden items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white sm:inline-flex"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredEvents.map((event) => {
              const place = allPlaces.find((item) => item.id === event.placeId)

              return (
                <Link
                  key={event.id}
                  href={getEventMapHref(event.placeId, event.date)}
                  className="group block rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {event.category && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getCategoryTone(
                            event.category
                          )}`}
                        >
                          {event.category}
                        </span>
                      )}

                      {event.price && (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/80">
                          {event.price}
                        </span>
                      )}
                    </div>

                    {event.highlight && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                        Hot
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-xl font-semibold leading-tight text-white">
                    {event.title}
                  </h3>

                  <div className="mt-4 space-y-2 text-sm text-white/55">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{event.date}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      <span>{event.time}</span>
                    </div>

                    {place && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{place.name}</span>
                      </div>
                    )}
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/65">
                    {event.description}
                  </p>

                  <div className="mt-5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 transition group-hover:text-blue-300">
                      Open in map
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <MapPin className="h-5 w-5 text-violet-400" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  Trending Places
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  Discover the places people are checking out most
                </p>
              </div>
            </div>

            <Link
              href={buildSearchUrl('/map', locationInput, searchQuery)}
              className="hidden items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white sm:inline-flex"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredPlaces.map((place) => (
              <Link
                key={place.id}
                href={`/map?place=${place.id}&category=${place.category}`}
                className="group block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className="relative h-56 w-full overflow-hidden">
                  {place.imageUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center transition duration-300 group-hover:scale-[1.02]"
                      style={{ backgroundImage: `url(${place.imageUrl})` }}
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-violet-600/20 via-blue-600/10 to-transparent" />
                  )}
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getPlaceCategoryTone(
                        place.category
                      )}`}
                    >
                      {place.category}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-semibold text-white">
                    {place.name}
                  </h3>

                  <div className="mt-3 flex items-center gap-2 text-sm text-white/55">
                    <MapPin className="h-4 w-4" />
                    <span>{place.city ?? 'Albania'}</span>
                  </div>

                  {place.options?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {place.options.slice(0, 4).map((option) => (
                        <span
                          key={option}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 transition group-hover:text-blue-300">
                      Open in map
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-10 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="text-5xl font-bold text-white">{t('submit_event')}</h2>

          <p className="mt-8 text-2xl text-white/55">
            {t('submit_event_subtitle')}
          </p>

          <div className="mt-12">
            <Link
              href="/submit-event"
              className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.02] px-10 py-5 text-2xl font-semibold text-white transition hover:bg-white/[0.05]"
            >
              {t('submit_event')}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">
              Alba<span className="text-blue-500">Go</span>
            </span>
          </div>

          <p className="text-sm text-white/45">{t('footer_rights')}</p>
        </div>
      </footer>
    </main>
  )
}