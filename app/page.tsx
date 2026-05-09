'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import SaveEventButton from '@/components/SaveEventButton'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { getLocationBySlug, locations } from '@/lib/locations'
import { useLocations } from '@/lib/useLocations'
import { createClient } from '@/lib/supabase/browser'
import { fetchSavedEventIds } from '@/lib/savedEvents'
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

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildSearchUrl(
  path: '/events' | '/map',
  locationSlug: string,
  query: string
) {
  const params = new URLSearchParams()

  if (locationSlug) {
    params.set('location', locationSlug)
  }

  if (query.trim()) {
    params.set('q', query.trim())
  }

  return `${path}?${params.toString()}`
}

type SuggestionEvent = { id: string; slug: string; title: string; category: string; location_slug: string }

export default function HomePage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
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
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchSuggestionEvents, setSearchSuggestionEvents] = useState<SuggestionEvent[]>([])
  const [isAuth, setIsAuth] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const prevLocationLabel = useRef<string>('')
  const locationInputValue = useRef<string>('Tirana')
  const locationDropdownRef = useRef<HTMLDivElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const locationOptionsRef = useRef(locationOptions)

  useEffect(() => {
    locationOptionsRef.current = locationOptions
  }, [locationOptions])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      setIsAuth(!!user)
      if (user) {
        const ids = await fetchSavedEventIds(supabase)
        if (!cancelled) setSavedIds(ids)
      }
    })()
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
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
          slug: e.slug,
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
  }, [activeLocationSlug, supabase])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestionEvents([])
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('events')
        .select('id, slug, title, category, location_slug')
        .eq('status', 'published')
        .ilike('title', `%${searchQuery.trim()}%`)
        .limit(4)
      setSearchSuggestionEvents(data ?? [])
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery, supabase])

  useEffect(() => {
    locationInputValue.current = locationInput
  }, [locationInput])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setIsLocationOpen(false)
        const typed = locationInputValue.current.trim()
        if (typed === '') {
          setLocationInput(prevLocationLabel.current)
          return
        }
        const exact = locationOptionsRef.current.find(
          (l) => l.label.toLowerCase() === typed.toLowerCase()
        )
        if (exact) {
          setLocationInput(exact.label)
          setActiveLocationSlug(exact.slug)
        } else {
          setLocationInput(prevLocationLabel.current)
        }
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        let nearest = locationOptions[0] ?? locations[0]
        let nearestKm = Infinity
        for (const loc of locationOptions) {
          const km = distanceKm(latitude, longitude, loc.center[1], loc.center[0])
          if (km < nearestKm) { nearestKm = km; nearest = loc }
        }

        if (nearestKm <= 150) {
          setLocationInput(nearest.label)
          setActiveLocationSlug(nearest.slug)
          setIsLocating(false)
          setIsLocationOpen(false)
          return
        }

        // User is far from all known cities — try reverse geocoding
        let cityLabel = 'Your current location'
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 4000)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'User-Agent': 'AlbaGo/1.0' }, signal: controller.signal }
          )
          clearTimeout(timer)
          if (res.ok) {
            const data = await res.json()
            const city = data.address?.city || data.address?.town || data.address?.village
            if (city) cityLabel = city
          }
        } catch {
          // silent — fallback label already set
        }

        setLocationInput(cityLabel)
        setActiveLocationSlug(
          cityLabel === 'Your current location'
            ? 'current-location'
            : cityLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
        )
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
  const resolvedLocation = getLocationBySlug(activeLocationSlug)

  const searchQ = searchQuery.trim().toLowerCase()
  const isTyping = searchQ.length > 0

  // Suggestions shown while typing — events from DB, filtered cats, filtered locs
  const suggestEvents = isTyping ? searchSuggestionEvents : []
  const suggestCats = isTyping
    ? categories.filter((c) => c.value.includes(searchQ))
    : categories
  const suggestLocs = isTyping
    ? locationOptions.filter(
        (l) =>
          l.label.toLowerCase().includes(searchQ) ||
          l.country.toLowerCase().includes(searchQ)
      ).slice(0, 3)
    : locationOptions.slice(0, 5)
  // Default (empty focus) events — use already-loaded featured events
  const defaultEvents = featuredEvents.slice(0, 3)
  const hasAnySuggestion =
    isTyping
      ? suggestEvents.length > 0 || suggestCats.length > 0 || suggestLocs.length > 0
      : true // default state always has categories

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
            <div className="relative" ref={searchContainerRef}>
              <div className="flex h-14 items-center gap-3 rounded-2xl bg-[#0b1020] px-4">
                <Search className="h-5 w-5 text-white/35" />

                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setIsSearchOpen(true)
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      setIsSearchOpen(false)
                      router.push(buildSearchUrl('/events', activeLocationSlug, searchQuery))
                    }
                  }}
                  placeholder="Search events, clubs, food..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/35"
                />
              </div>

              {isSearchOpen && hasAnySuggestion && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-[420px] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#0b1020] text-left shadow-2xl">

                  {/* ── Categories ── */}
                  {suggestCats.length > 0 && (
                    <>
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {isTyping ? 'Category' : 'Explore'}
                      </p>
                      {suggestCats.map((cat) => {
                        const Icon = cat.icon
                        return (
                          <Link
                            key={cat.value}
                            href={`/events?location=${activeLocationSlug}&category=${cat.value}`}
                            onClick={() => setIsSearchOpen(false)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.06]"
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${getCategoryTone(cat.value)}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="capitalize font-medium text-white">{cat.value}</span>
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-white/30">Category</span>
                          </Link>
                        )
                      })}
                    </>
                  )}

                  {/* ── Events (default: featured; typing: DB ilike results) ── */}
                  {(isTyping ? suggestEvents : defaultEvents).length > 0 && (
                    <>
                      <div className="mx-4 border-t border-white/[0.06]" />
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {isTyping ? 'Events' : 'Upcoming'}
                      </p>
                      {(isTyping ? suggestEvents : defaultEvents).map((ev) => (
                        <Link
                          key={ev.id}
                          href={`/events/${ev.slug}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.06]"
                        >
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getCategoryTone(ev.category)}`}>
                            {ev.category}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium text-white">{ev.title}</span>
                          {isTyping && 'location_slug' in ev && (
                            <span className="shrink-0 text-[10px] text-white/30">
                              {getLocationBySlug((ev as SuggestionEvent).location_slug).label}
                            </span>
                          )}
                          {!isTyping && (
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-white/30">Event</span>
                          )}
                        </Link>
                      ))}
                    </>
                  )}

                  {/* ── Cities ── */}
                  {suggestLocs.length > 0 && (
                    <>
                      <div className="mx-4 border-t border-white/[0.06]" />
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {isTyping ? 'Cities' : 'Browse by city'}
                      </p>
                      {suggestLocs.map((loc) => (
                        <Link
                          key={loc.slug}
                          href={`/events?location=${loc.slug}`}
                          onClick={() => {
                            setLocationInput(loc.label)
                            setActiveLocationSlug(loc.slug)
                            setIsSearchOpen(false)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.06]"
                        >
                          <MapPin className="h-4 w-4 shrink-0 text-white/35" />
                          <span className="font-medium text-white">{loc.label}</span>
                          <span className="ml-auto text-[10px] text-white/30">{loc.country}</span>
                        </Link>
                      ))}
                    </>
                  )}

                </div>
              )}
            </div>

            <div className="relative" ref={locationDropdownRef}>
              <div className="flex h-14 items-center gap-3 rounded-2xl bg-[#0b1020] px-4">
                <MapPin className="h-5 w-5 text-white/35" />

                <input
                  value={locationInput}
                  onFocus={() => {
                    prevLocationLabel.current = locationInput
                    setLocationInput('')
                    setIsLocationOpen(true)
                  }}
                  onChange={(event) => {
                    setLocationInput(event.target.value)
                    setIsLocationOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      const typed = locationInput.trim()
                      const exact = locationOptions.find(
                        (l) => l.label.toLowerCase() === typed.toLowerCase()
                      )
                      if (exact) {
                        setLocationInput(exact.label)
                        setActiveLocationSlug(exact.slug)
                      } else {
                        setLocationInput(prevLocationLabel.current)
                      }
                      setIsLocationOpen(false)
                    }
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
              href={buildSearchUrl('/events', activeLocationSlug, searchQuery)}
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

              return (
                <Link
                  key={category.value}
                  href={`/events?location=${activeLocationSlug}&category=${category.value}`}
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
              href={buildSearchUrl('/events', activeLocationSlug, searchQuery)}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-10 py-5 text-xl font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.35)] transition hover:bg-blue-500"
            >
              <Calendar className="h-5 w-5" />
              Browse Events
            </Link>

            <Link
              href={buildSearchUrl('/map', activeLocationSlug, searchQuery)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-10 py-5 text-xl font-semibold text-white transition hover:bg-white/[0.04]"
            >
              <MapPin className="h-5 w-5" />
              {t('open_map')}
            </Link>

            <Link
              href={`/events?location=${activeLocationSlug}&time=tonight`}
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
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
            Across the platform
          </p>
          <div className="flex items-center justify-around">
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
              href={buildSearchUrl('/events', activeLocationSlug, searchQuery)}
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
                  href={`/events/${event.slug}`}
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

                    <div className="flex items-center gap-2">
                      {event.highlight && (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                          Hot
                        </span>
                      )}

                      <SaveEventButton
                        eventId={event.id}
                        initialSaved={savedIds.has(event.id)}
                        isAuthenticated={isAuth}
                      />
                    </div>
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
                      View event
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
              href={buildSearchUrl('/map', activeLocationSlug, searchQuery)}
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