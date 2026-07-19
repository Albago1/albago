'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import 'maplibre-gl/dist/maplibre-gl.css'

import FilterBar from '@/components/layout/FilterBar'
import type { MapSearchIndex } from '@/lib/mapSearch'
import PlacePanel from '@/components/place/PlacePanel'
import MapEventCard from '@/components/map/MapEventCard'
import MapResultsSheet from '@/components/map/MapResultsSheet'
import { languageLocales } from '@/lib/i18n/config'
import type { Place } from '@/types/place'
import type { Event } from '@/types/event'
import { createMaplibreAdapter } from '@/components/map/maplibreAdapter'
import type { MapAdapter, MapMarkerInput } from '@/components/map/map.types'
import { isToday, isThisWeekend } from '@/lib/dateFilters'
import { createClient } from '@/lib/supabase/browser'
import { getLocationBySlug } from '@/lib/locations'
import { useLocations } from '@/lib/useLocations'
import { fetchSavedEventIds } from '@/lib/savedEvents'
import { eventMatchesDate, hasOccurrenceInRange, todayIso } from '@/lib/recurrence'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { categoryLabel } from '@/components/events/categoryMeta'

type TimeFilter = 'all' | 'tonight' | 'weekend' | 'week'

// Direct-pin event: a published event with its own lat/lng and no place_id
// linking it to a venue. Covers civic protests AND any regular event whose
// submitter geocoded an address through the wizard. Rendered on the map as
// its own marker (not via a place).
type CivicMapEvent = {
  id: string
  slug: string
  title: string
  category: string | null
  isCivic: boolean
  date: string
  time: string | null
  country: string | null
  locationSlug: string | null
  lat: number
  lng: number
  expectedAttendees: number | null
  bannerUrl: string | null
  price: string | null
  highlight: boolean
  recurrence: string | null
  recurrenceUntil: string | null
  recurrenceDaysOfWeek: number[] | null
  recurrenceExceptions: string[] | null
}

// Accent-insensitive matching: "tirana" must find "Tiranë", "durres" must
// find "Durrës" — same rule the /events search already follows.
function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function fmtLocalIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

// "This weekend" = today through the upcoming Sunday (covers Fri-evening
// usage). For Sat/Sun the range collapses to today..Sun. All math is on
// LOCAL date components — `Date.toISOString()` is UTC and would shift the
// window backward by a day around midnight in zones east of UTC, which is
// exactly the kind of off-by-one that silently drops Sunday events for a
// user filtering on Friday night in CEST.
function getWeekendIsoRange(): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = today.getDay() // 0=Sun..6=Sat
  let from = today
  let to: Date
  if (dow === 0) {
    to = today // Sunday → just today
  } else if (dow === 6) {
    to = new Date(today); to.setDate(today.getDate() + 1) // Sat → +Sun
  } else if (dow === 5) {
    to = new Date(today); to.setDate(today.getDate() + 2) // Fri → Sat + Sun
  } else {
    // Mon-Thu → jump forward to the upcoming Saturday, end on Sunday.
    from = new Date(today); from.setDate(today.getDate() + (6 - dow))
    to = new Date(from); to.setDate(from.getDate() + 1)
  }
  return { from: fmtLocalIso(from), to: fmtLocalIso(to) }
}

function getTimeFilterLabel(filter: TimeFilter, t: (key: string) => string) {
  if (filter === 'all') return t('filter_all')
  if (filter === 'tonight') return t('tonight')
  if (filter === 'week') return t('map_this_week')
  return t('filter_this_weekend')
}

function getValidTimeFilter(value: string | null): TimeFilter {
  if (value === 'tonight' || value === 'weekend' || value === 'week') return value
  return 'all'
}

// 7-day window starting today, in local date components.
function getWeekIsoRange(): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(today)
  end.setDate(today.getDate() + 7)
  return { from: fmtLocalIso(today), to: fmtLocalIso(end) }
}

// Worldwide view: roughly Europe-centered, low zoom. Sits just above the
// adapter's minZoom floor so the fully-zoomed-out map still pans. Module
// constants so effects can use them without depending on render values.
const worldCenter: [number, number] = [10, 30]
const worldZoom = 2.6

export default function MapView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locationOptions = useLocations()
  const { t, language } = useLanguage()

  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapAdapterRef = useRef<MapAdapter | null>(null)
  // Tracks the slug we've already auto-framed after data load, so changing a
  // filter doesn't yank the viewport around. Resets when the user picks a
  // different city.
  const initialFitDoneForSlugRef = useRef<string | null>(null)
  // Remembers the last country we re-framed to, so the country-zoom effect
  // can ignore the run that's triggered purely by data loading (vs. the
  // user actually clicking a different country chip).
  const lastCountryFitRef = useRef<string | null | undefined>(undefined)

  // Default to the worldwide view so the map opens onto the actual current
  // events (civic protests everywhere) instead of the city-scoped Tirana
  // venue map most visitors never asked for.
  //
  // We hold the picked slug in state, not derived from URL — `router.replace`
  // updates the URL but the useSearchParams re-render can lag behind the
  // synchronous flyToLocation call inside handleLocationChange, which left
  // the filter label / data fetch stuck on the *previous* city even after
  // the map flew to the new one. State keeps the UI in lockstep with the
  // user's pick; the URL is still mirrored as a side-effect so deep links
  // and back/forward still work.
  const urlLocationSlug = searchParams.get('location') || 'all'
  const [locationSlug, setLocationSlug] = useState<string>(urlLocationSlug)
  useEffect(() => {
    // External URL change (deep link, back/forward) → re-sync state.
    setLocationSlug(urlLocationSlug)
  }, [urlLocationSlug])
  const isWorldwide = locationSlug === 'all'
  const initialCountry = searchParams.get('country')
  const location = getLocationBySlug(locationSlug)

  const initialCategory = searchParams.get('category') || 'all'
  const initialPlaceId = searchParams.get('place')
  const initialTimeFilter = getValidTimeFilter(searchParams.get('time'))

  const [places, setPlaces] = useState<Place[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [civicEvents, setCivicEvents] = useState<CivicMapEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialPlaceId)
  // Event preview popup for civic / direct-pin events (matches /protests
  // popup pattern — see ProtestMap.tsx). Mutually exclusive with the
  // PlacePanel: opening one closes the other.
  const [selectedCivicEvent, setSelectedCivicEvent] = useState<CivicMapEvent | null>(null)
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>(initialTimeFilter)
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [searchQuery, setSearchQuery] = useState('')
  const [optionFilter, setOptionFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState<string | null>(initialCountry)
  const [isMobile, setIsMobile] = useState(false)
  // Auth + saved state so the event card's heart works exactly like it does
  // on /events cards.
  const [isAuth, setIsAuth] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  // Latest geolocate fix — drives the "you + what's happening around you"
  // framing below.
  const [userPos, setUserPos] = useState<[number, number] | null>(null)

  useEffect(() => {
    const supabase = createClient()
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
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')

    const updateIsMobile = (event?: MediaQueryListEvent) => {
      setIsMobile(event ? event.matches : mediaQuery.matches)
    }

    updateIsMobile()
    mediaQuery.addEventListener('change', updateIsMobile)

    return () => {
      mediaQuery.removeEventListener('change', updateIsMobile)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      setIsLoading(true)
      const activeFilter = activeEventsOrFilter()
      // "civicQuery" historically only fetched protests, but we use it as the
      // direct-pin layer for ANY published event that has its own lat/lng and
      // no place_id — so a wizard-created regular event (which writes coords
      // but never creates a places row) ends up on the map too. Events that
      // are tied to a venue still render via the place pin instead.
      const civicQuery = supabase
        .from('events')
        .select(
          'id, slug, title, category, is_civic, date, time, end_time, country, location_slug, lat, lng, expected_attendees, banner_url, price, highlight, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
        )
        .eq('status', 'published')
        .or(activeFilter)
        .is('place_id', null)
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      // Worldwide view: pull civic pins only (skipping places + non-civic
      // events keeps the wire payload manageable across every country). A
      // user that wants nightlife venues opens a specific city.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emptyRes = Promise.resolve({ data: [] as any[], error: null })
      const placesPromise = isWorldwide
        ? emptyRes
        : supabase
            .from('places')
            .select('*')
            .eq('location_slug', locationSlug)
      const eventsPromise = isWorldwide
        ? emptyRes
        : supabase
            .from('events')
            .select('*')
            .eq('status', 'published')
            .or(activeFilter)
            .eq('location_slug', locationSlug)
      if (!isWorldwide) {
        civicQuery.eq('location_slug', locationSlug)
      }

      const [placesRes, eventsRes, civicRes] = await Promise.all([
        placesPromise,
        eventsPromise,
        civicQuery,
      ])

      if (placesRes.data) {
        setPlaces(placesRes.data.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          category: p.category,
          lat: p.lat,
          lng: p.lng,
          description: p.description,
          options: Array.isArray(p.options) ? p.options : [],
          imageUrl: p.image_url ?? undefined,
          address: p.address ?? undefined,
          websiteUrl: p.website_url ?? undefined,
          status: p.status ?? undefined,
        })))
      }

      if (eventsRes.data) {
        setEvents(eventsRes.data.filter(isEventActive).map((e) => ({
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

      if (civicRes.data) {
        setCivicEvents(
          (civicRes.data as Array<{
            id: string
            slug: string
            title: string
            category: string | null
            is_civic: boolean | null
            date: string
            time: string | null
            end_time: string | null
            country: string | null
            location_slug: string | null
            lat: number
            lng: number
            expected_attendees: number | null
            banner_url: string | null
            price: string | null
            highlight: boolean | null
            recurrence: string | null
            recurrence_until: string | null
            recurrence_days_of_week: number[] | null
            recurrence_exceptions: string[] | null
          }>)
            .filter(isEventActive)
            .map((row) => ({
              id: row.id,
              slug: row.slug,
              title: row.title,
              category: row.category,
              isCivic: !!row.is_civic,
              date: row.date,
              time: row.time,
              country: row.country,
              locationSlug: row.location_slug,
              lat: row.lat,
              lng: row.lng,
              expectedAttendees: row.expected_attendees,
              bannerUrl: row.banner_url,
              price: row.price,
              highlight: !!row.highlight,
              recurrence: row.recurrence,
              recurrenceUntil: row.recurrence_until,
              recurrenceDaysOfWeek: row.recurrence_days_of_week,
              recurrenceExceptions: row.recurrence_exceptions,
            }))
        )
      } else {
        setCivicEvents([])
      }

      setIsLoading(false)
    }

    fetchData()
  }, [locationSlug, isWorldwide])

  useEffect(() => {
    const nextCategory = searchParams.get('category') || 'all'
    setActiveCategory(nextCategory)
  }, [searchParams])

  useEffect(() => {
    const nextPlaceId = searchParams.get('place')
    setSelectedPlaceId(nextPlaceId)
  }, [searchParams])

  useEffect(() => {
    const nextTimeFilter = getValidTimeFilter(searchParams.get('time'))
    setActiveTimeFilter(nextTimeFilter)
  }, [searchParams])

  useEffect(() => {
    setCountryFilter(searchParams.get('country'))
  }, [searchParams])

  const filteredEvents = useMemo(() => {
    const week = getWeekIsoRange()
    return events.filter((event) => {
      if (activeTimeFilter === 'all') return true
      // Regular events go through the legacy single-date filter — they may
      // also be recurring (events.* SELECT includes recurrence cols) but the
      // local Event type doesn't carry them through, so we keep the simple
      // behavior here and let the visibleCivicEvents path handle the civic
      // recurrence case the user actually noticed.
      if (activeTimeFilter === 'tonight') return isToday(event.date)
      if (activeTimeFilter === 'weekend') return isThisWeekend(event.date)
      if (activeTimeFilter === 'week') return event.date >= week.from && event.date <= week.to
      return true
    })
  }, [activeTimeFilter, events])

  const civicCountryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ev of civicEvents) {
      const key = (ev.country ?? '').trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([country, count]) => ({ country, count }))
  }, [civicEvents])

  const visibleCivicEvents = useMemo(() => {
    const normalizedSearch = fold(searchQuery.trim())
    const today = todayIso()
    const weekend = getWeekendIsoRange()
    const week = getWeekIsoRange()
    // Resolve human-readable city labels lazily so search can match
    // "berlin" / "tirana" against location_slug → city label, not just
    // the bare slug.
    const slugToCity = new Map<string, string>()
    for (const opt of locationOptions) {
      slugToCity.set(opt.slug, fold(opt.label))
    }
    return civicEvents.filter((event) => {
      // Category chip: 'all' = everything; 'civic' = is_civic events
      // regardless of stored category; anything else matches event.category.
      const categoryMatch =
        activeCategory === 'all' ||
        (activeCategory === 'civic'
          ? event.isCivic || event.category === 'civic'
          : event.category === activeCategory)
      if (!categoryMatch) return false

      // For the time filter, ask the recurrence helpers when this event
      // actually runs — so a weekly Saturday protest with a months-old
      // series start still matches the "This weekend" filter.
      const recurringShape = {
        date: event.date,
        time: event.time,
        recurrence: event.recurrence,
        recurrence_until: event.recurrenceUntil,
        recurrence_days_of_week: event.recurrenceDaysOfWeek,
        recurrence_exceptions: event.recurrenceExceptions,
      }
      const timeMatch =
        activeTimeFilter === 'all'
          ? true
          : activeTimeFilter === 'tonight'
            ? eventMatchesDate(recurringShape, today)
            : activeTimeFilter === 'week'
              ? hasOccurrenceInRange(recurringShape, week.from, week.to)
              : hasOccurrenceInRange(recurringShape, weekend.from, weekend.to)
      const countryMatch =
        !countryFilter || (event.country ?? '').trim() === countryFilter
      const cityLabel = event.locationSlug ? slugToCity.get(event.locationSlug) ?? '' : ''
      const searchMatch =
        normalizedSearch.length === 0 ||
        fold(event.title).includes(normalizedSearch) ||
        fold(event.country ?? '').includes(normalizedSearch) ||
        cityLabel.includes(normalizedSearch) ||
        fold(event.locationSlug ?? '').includes(normalizedSearch)
      return timeMatch && countryMatch && searchMatch
    })
  }, [civicEvents, activeCategory, activeTimeFilter, searchQuery, countryFilter, locationOptions])

  const availableOptionChips = useMemo(() => {
    const allOptions = places.flatMap((place) => place.options ?? [])
    return [...new Set(allOptions)]
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 12)
  }, [places])

  const visiblePlaces = useMemo(() => {
    const placeIdsWithEvents = new Set(filteredEvents.map((event) => event.placeId))
    const normalizedSearch = fold(searchQuery.trim())

    return places.filter((place) => {
      const categoryMatch =
        activeCategory === 'all' || place.category === activeCategory

      const timeMatch =
        activeTimeFilter === 'all' ? true : placeIdsWithEvents.has(place.id)

      const optionMatch =
        optionFilter === 'all' ||
        place.options?.some(
          (option) => option.toLowerCase() === optionFilter.toLowerCase()
        )

      const searchMatch =
        normalizedSearch.length === 0 ||
        fold(place.name).includes(normalizedSearch) ||
        fold(place.description).includes(normalizedSearch) ||
        fold(place.category).includes(normalizedSearch) ||
        place.options?.some((option) =>
          fold(option).includes(normalizedSearch)
        )

      return categoryMatch && timeMatch && optionMatch && searchMatch
    })
  }, [places, activeCategory, activeTimeFilter, filteredEvents, optionFilter, searchQuery])

  const visiblePlaceIds = useMemo(() => {
    return new Set(visiblePlaces.map((place) => place.id))
  }, [visiblePlaces])

  const visibleEventsCount = useMemo(() => {
    const placeEventCount = filteredEvents.filter(
      (event) => event.placeId != null && visiblePlaceIds.has(event.placeId)
    ).length
    return placeEventCount + visibleCivicEvents.length
  }, [filteredEvents, visiblePlaceIds, visibleCivicEvents])

  const selectedPlace = useMemo<Place | null>(() => {
    return places.find((place) => place.id === selectedPlaceId) ?? null
  }, [selectedPlaceId, places])

  const hasNoResults =
    !isLoading && visiblePlaces.length === 0 && visibleCivicEvents.length === 0

  // Google Maps behavior: closing a card or tapping empty map just
  // deselects — the camera stays exactly where the user left it. (The old
  // re-fit-everything reset zoomed a worldwide view all the way out to the
  // whole planet every time a card closed.)
  const closeCivicPopup = () => {
    setSelectedCivicEvent(null)
  }

  useEffect(() => {
    if (!mapRef.current || mapAdapterRef.current) return

    mapAdapterRef.current = createMaplibreAdapter({
      container: mapRef.current,
      center: isWorldwide ? worldCenter : location.center,
      zoom: isWorldwide ? worldZoom : location.zoom,
      onMapClick: () => {
        setSelectedPlaceId(null)
        setSelectedCivicEvent(null)
      },
      onGeolocate: (center) => setUserPos(center),
    })

    return () => {
      mapAdapterRef.current?.destroy()
      mapAdapterRef.current = null
    }
    // Mount-only by design: isWorldwide/location.* are just the initial
    // camera. The adapter is created once; later location changes are
    // handled by the fly-to / initial-fit effects, and recreating the map
    // here would destroy it on every city switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Google Maps behavior: the map opens centered on the visitor. Trigger
  // locate on every open (prompting first-timers, exactly like Google Maps
  // does) unless permission is explicitly denied — the Permissions API is
  // missing for geolocation on some mobile browsers, so an unavailable /
  // failing query counts as "go ahead" rather than silently skipping.
  // A deep-linked city in the URL always wins over auto-locate.
  const autoLocateAttemptedRef = useRef(false)
  useEffect(() => {
    if (autoLocateAttemptedRef.current) return
    autoLocateAttemptedRef.current = true
    if (searchParams.get('location')) return
    const adapter = mapAdapterRef.current
    if (!adapter) return
    let cancelled = false
    const locate = () => {
      if (cancelled) return
      // Claim the initial data-load fit so it doesn't yank the viewport
      // away from the user's position a few seconds after locate lands.
      initialFitDoneForSlugRef.current = locationSlug
      adapter.locateUser()
    }
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (status.state !== 'denied') locate()
        })
        .catch(locate)
    } else {
      locate()
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Google framing: once we know where the user is AND the data has loaded,
  // widen the view from "their street" to "them plus what's happening around
  // them" — the nearest pins within ~120 km. Runs once per session; skipped
  // when nothing is nearby (the street-level locate view stays). Our
  // fitBounds also flips the geolocate control to background mode, so the
  // live blue dot keeps updating without snapping the camera back.
  const userFrameDoneRef = useRef(false)
  useEffect(() => {
    if (!userPos || isLoading || userFrameDoneRef.current) return
    const adapter = mapAdapterRef.current
    if (!adapter) return
    userFrameDoneRef.current = true
    const kmFrom = ([lng, lat]: [number, number]) => {
      const dx = (lng - userPos[0]) * Math.cos((userPos[1] * Math.PI) / 180)
      const dy = lat - userPos[1]
      return Math.sqrt(dx * dx + dy * dy) * 111
    }
    const nearby = [
      ...civicEvents.map((e): [number, number] => [e.lng, e.lat]),
      ...places.map((p): [number, number] => [p.lng, p.lat]),
    ]
      .map((coord) => ({ coord, km: kmFrom(coord) }))
      .filter((entry) => entry.km <= 120)
      .sort((a, b) => a.km - b.km)
      .slice(0, 5)
    if (nearby.length === 0) return
    adapter.fitBounds([userPos, ...nearby.map((entry) => entry.coord)], {
      padding: 90,
      maxZoom: 13,
    })
  }, [userPos, isLoading, civicEvents, places])

  // While the on-screen keyboard is up, the dvh container shrinks and every
  // floating bottom element (loading chip, results pill, no-results toast)
  // would slide up under the search pill — hide them all until it closes.
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setKeyboardOpen(window.innerHeight - vv.height - vv.offsetTop > 150)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    const adapter = mapAdapterRef.current
    if (!adapter) return

    const placeMarkers: MapMarkerInput[] = visiblePlaces.map((place) => {
      const placeEvents = filteredEvents.filter((event) => event.placeId === place.id)

      return {
        id: place.id,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        kind: 'venue' as const,
        category: place.category,
        eventCount: placeEvents.length,
        hasHighlight: placeEvents.some((event) => event.highlight),
        isSelected: place.id === selectedPlaceId,
        onClick: () => {
          setSelectedPlaceId(place.id)
          setSelectedCivicEvent(null)
        },
      }
    })

    const civicMarkers: MapMarkerInput[] = visibleCivicEvents.map((event) => ({
      id: `civic-${event.id}`,
      name: event.title,
      lat: event.lat,
      lng: event.lng,
      kind: 'event' as const,
      // Real category so the pin carries the category color; civic events
      // stay flame regardless of what their stored category says.
      category: event.isCivic ? 'civic' : (event.category ?? 'other'),
      eventCount: 1,
      hasHighlight: true,
      isSelected: selectedCivicEvent?.id === event.id,
      onClick: () => {
        setSelectedCivicEvent(event)
        setSelectedPlaceId(null)
        const adapter = mapAdapterRef.current
        if (adapter) {
          // Never zoom the user OUT of a view they chose — only in, to a
          // country-level frame worldwide or a street-level frame in a city.
          // Padding keeps the pin clear of the preview card (bottom sheet on
          // mobile, floating bottom-left card on desktop).
          const targetZoom = Math.max(adapter.getZoom(), isWorldwide ? 6.5 : 12.5)
          adapter.flyToLocation(
            [event.lng, event.lat],
            targetZoom,
            // Card now sits above the floating bottom nav — pad accordingly.
            isMobile ? { bottom: 400 } : { left: 420 },
          )
        }
      },
    }))

    adapter.setMarkers([...placeMarkers, ...civicMarkers])
    }, [visiblePlaces, selectedPlaceId, selectedCivicEvent, filteredEvents, visibleCivicEvents, isWorldwide, isMobile])

  useEffect(() => {
    if (!selectedPlaceId) return

    const stillVisible = visiblePlaces.some((place) => place.id === selectedPlaceId)

    if (!stillVisible) {
      setSelectedPlaceId(null)
    }
  }, [selectedPlaceId, visiblePlaces])

  // Drop the civic popup if the filter strips its pin away (mirrors the
  // protest map cleanup so the card never dangles over an empty viewport).
  useEffect(() => {
    if (!selectedCivicEvent) return
    const stillVisible = visibleCivicEvents.some((e) => e.id === selectedCivicEvent.id)
    if (!stillVisible) setSelectedCivicEvent(null)
  }, [selectedCivicEvent, visibleCivicEvents])

  useEffect(() => {
    const adapter = mapAdapterRef.current
    if (!adapter || !selectedPlace) return

    adapter.flyToPlace({
      lng: selectedPlace.lng,
      lat: selectedPlace.lat,
      isMobile,
    })
  }, [selectedPlace, isMobile])

  const selectedPlaceEvents = selectedPlace
    ? filteredEvents.filter((event) => event.placeId === selectedPlace.id)
    : []

  // Resolve a human-readable city label for the card: dynamic list first,
  // then a titleized slug — never nothing when the event has a city at all.
  const selectedCivicCity = selectedCivicEvent?.locationSlug
    ? locationOptions.find((o) => o.slug === selectedCivicEvent.locationSlug)?.label ??
      selectedCivicEvent.locationSlug
        .split('-')
        .map((part) => (part[0]?.toUpperCase() ?? '') + part.slice(1))
        .join(' ')
    : null

  const handleResetFilters = () => {
    setActiveTimeFilter('all')
    setActiveCategory('all')
    setSearchQuery('')
    setOptionFilter('all')
    setCountryFilter(null)
  }

  // City label + short local date for suggestion / results rows.
  const cityLabelForSlug = (slug: string | null, country: string | null) => {
    if (slug) {
      const match = locationOptions.find((o) => o.slug === slug)
      if (match) return match.label
      return slug
        .split('-')
        .map((part) => (part[0]?.toUpperCase() ?? '') + part.slice(1))
        .join(' ')
    }
    return country ?? ''
  }

  const eventRowSub = (event: CivicMapEvent) => {
    const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString(
      languageLocales[language],
      { weekday: 'short', day: 'numeric', month: 'short' },
    )
    return [cityLabelForSlug(event.locationSlug, event.country), dateLabel, event.time?.slice(0, 5)]
      .filter(Boolean)
      .join(' · ')
  }

  const eventRowCategory = (event: CivicMapEvent) =>
    event.isCivic ? 'civic' : (event.category ?? 'other')

  // Select an event / venue by id — shared by pin taps (via markers),
  // search suggestions, and the results sheet, so every entry point gets
  // the identical select-and-fly behavior.
  const selectCivicEventById = (id: string) => {
    const event = civicEvents.find((e) => e.id === id)
    if (!event) return
    setSelectedCivicEvent(event)
    setSelectedPlaceId(null)
    const adapter = mapAdapterRef.current
    if (adapter) {
      const targetZoom = Math.max(adapter.getZoom(), isWorldwide ? 6.5 : 12.5)
      adapter.flyToLocation(
        [event.lng, event.lat],
        targetZoom,
        isMobile ? { bottom: 400 } : { left: 420 },
      )
    }
  }

  const selectPlaceById = (id: string) => {
    setSelectedPlaceId(id)
    setSelectedCivicEvent(null)
  }

  // The search index: everything the unified search box can rank — every
  // loaded city, event, and venue (with coordinates so recent-search entries
  // can fly the camera even after the underlying data scope changes). The
  // matching/ranking itself lives in lib/mapSearch.ts.
  const searchIndex = useMemo<MapSearchIndex>(
    () => ({
      cities: locationOptions.map((o) => ({
        slug: o.slug,
        label: o.label,
        country: o.country,
        center: o.center,
      })),
      events: civicEvents.map((e) => ({
        id: e.id,
        title: e.title,
        sub: eventRowSub(e),
        category: eventRowCategory(e),
        center: [e.lng, e.lat] as [number, number],
      })),
      places: places.map((p) => ({
        id: p.id,
        name: p.name,
        sub: p.address ?? p.category,
        center: [p.lng, p.lat] as [number, number],
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [civicEvents, places, locationOptions, language],
  )

  // Search picks: select the pin when it's in the loaded data; when it came
  // from recent-search memory and the current scope no longer includes it
  // (e.g. saved in Berlin, map now on Tirana), still honor the pick by
  // flying to its stored coordinates.
  const handleSearchPickEvent = (id: string, center: [number, number]) => {
    if (civicEvents.some((e) => e.id === id)) {
      selectCivicEventById(id)
      return
    }
    mapAdapterRef.current?.flyToLocation(center, 12.5)
  }

  const handleSearchPickPlace = (id: string, center: [number, number]) => {
    if (places.some((p) => p.id === id)) {
      selectPlaceById(id)
      return
    }
    mapAdapterRef.current?.flyToLocation(center, 12.5)
  }

  const handleUseMyLocation = () => {
    mapAdapterRef.current?.locateUser()
  }

  // Everything currently visible on the map, as list rows for the
  // bottom results sheet.
  const sheetEvents = useMemo(
    () =>
      visibleCivicEvents.map((e) => ({
        id: e.id,
        title: e.title,
        sub: eventRowSub(e),
        category: eventRowCategory(e),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleCivicEvents, locationOptions, language],
  )
  const sheetPlaces = useMemo(
    () =>
      visiblePlaces.map((p) => ({
        id: p.id,
        name: p.name,
        sub: p.address ?? p.category,
      })),
    [visiblePlaces],
  )

  const handleLocationChange = (slug: string, center?: [number, number]) => {
    // Update local state first so the filter label, data fetch, and every
    // downstream useMemo re-key against the new slug on this render — don't
    // wait for the URL roundtrip.
    setLocationSlug(slug)
    const params = new URLSearchParams()
    params.set('location', slug)
    if (activeTimeFilter !== 'all') params.set('time', activeTimeFilter)
    if (activeCategory !== 'all') params.set('category', activeCategory)
    if (center) {
      params.set('lng', String(center[0]))
      params.set('lat', String(center[1]))
    }
    // Country filter only makes sense in worldwide mode; drop it when the
    // user picks a specific city.
    setCountryFilter(null)
    router.replace(`/map?${params.toString()}`)
    // For dynamic (Nominatim-resolved) cities we may not have a matching
    // entry in static `cities`, so fly directly to the resolved coords.
    if (center && mapAdapterRef.current) {
      mapAdapterRef.current.flyToLocation(center, 12.5)
    }
  }

  // Resolve the active location's display label from the dynamic options
  // (cities table UNION distinct event cities). Falls back to the static
  // helper for legacy slugs that aren't in either set.
  const dynamicMatch = locationOptions.find((o) => o.slug === locationSlug)
  const activeLocationLabel = isWorldwide
    ? t('map_worldwide')
    : dynamicMatch?.label ?? location.label

  useEffect(() => {
    const adapter = mapAdapterRef.current
    if (!adapter) return
    // A brand-new slug means we'll want to re-frame to its data once it loads.
    initialFitDoneForSlugRef.current = null
    if (isWorldwide) {
      adapter.flyToLocation(worldCenter, worldZoom)
      return
    }
    // Prefer the dynamic option's coords (covers Nominatim-derived cities
    // that aren't in the static cities array).
    const center = dynamicMatch?.center ?? location.center
    const zoom = dynamicMatch?.zoom ?? location.zoom
    adapter.flyToLocation(center, zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSlug])

  // After the first data load for a given slug, frame the map around the
  // markers we actually have. This is what fixes the "/map?location=berlin
  // shows the Tirana map and you have to manually pan to find the Berlin pin"
  // problem — getLocationBySlug only knows 4 hardcoded cities, so for any
  // Nominatim-derived slug (berlin, praha, frankfurt-am-main, …) the static
  // fallback was Tirana. Fitting to the loaded data sidesteps that entirely.
  useEffect(() => {
    if (isLoading) return
    const adapter = mapAdapterRef.current
    if (!adapter) return
    if (initialFitDoneForSlugRef.current === locationSlug) return
    const coords: [number, number][] = []
    places.forEach((p) => coords.push([p.lng, p.lat]))
    civicEvents.forEach((e) => coords.push([e.lng, e.lat]))
    if (coords.length > 0) {
      adapter.fitBounds(coords, {
        padding: 80,
        maxZoom: coords.length === 1 ? 11 : 9,
      })
    }
    initialFitDoneForSlugRef.current = locationSlug
  }, [isLoading, locationSlug, places, civicEvents])

  // Per-country zoom-on-click: when the user picks a country chip, frame
  // the map around that country's civic pins. When they clear the filter
  // and we're still in worldwide mode, snap back to the global view.
  // Gated by a ref so the initial data load doesn't trigger this — that
  // first paint is owned by the initial-fit effect above.
  useEffect(() => {
    if (isLoading) return
    const adapter = mapAdapterRef.current
    if (!adapter) return

    const isFirstRun = lastCountryFitRef.current === undefined
    const sameAsLast = !isFirstRun && lastCountryFitRef.current === countryFilter
    if (sameAsLast) return
    lastCountryFitRef.current = countryFilter

    if (countryFilter == null) {
      // On first paint with no country picked, let the initial-fit effect
      // handle framing. Only fly back to worldCenter when the user actively
      // clears a previously-set country.
      if (isFirstRun) return
      if (isWorldwide) adapter.flyToLocation(worldCenter, worldZoom)
      return
    }

    const coords = civicEvents
      .filter((e) => (e.country ?? '').trim() === countryFilter)
      .map((e): [number, number] => [e.lng, e.lat])

    if (coords.length === 0) return
    if (coords.length === 1) {
      adapter.flyToLocation(coords[0], 8)
    } else {
      adapter.fitBounds(coords, { padding: 80, maxZoom: 6.5 })
    }
  }, [countryFilter, civicEvents, isLoading, isWorldwide])

  // Google Maps behavior: the map page itself must never scroll — the map
  // owns the whole visible viewport (dvh, so it resizes with the browser
  // bars instead of extending behind them) and the document is locked so
  // panning/zooming can't rubber-band the page or bounce the browser chrome.
  useEffect(() => {
    const html = document.documentElement
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    // iOS Safari can still scroll the locked body (native dialogs, focus,
    // rubber-banding). The map container is fixed so it can't move, but the
    // page behind must stay at 0 or visualViewport offsets (bottom nav lift,
    // keyboard detection) drift — snap back whenever it happens.
    window.scrollTo(0, 0)
    const pinScroll = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }
    window.addEventListener('scroll', pinScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', pinScroll)
      html.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  return (
    // Fixed to the viewport (not in-flow): iOS Safari can scroll the body
    // despite the overflow lock (e.g. after the geolocation permission
    // dialog), which used to drag the search pill up off-screen. A fixed
    // container can't be moved by document scroll — the map UI stays put
    // no matter what the browser chrome does. z-30 keeps the bottom nav
    // (z-40) and portaled modals (z-80) above.
    <div className="fixed inset-0 z-30 overflow-hidden bg-ink-950">
      <div ref={mapRef} className="h-full w-full" />

      {isLoading && !keyboardOpen && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-ink-950/85 px-5 py-3 text-sm text-white/70 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flame-500" />
            </span>
            {t('map_loading')}
          </div>
        </div>
      )}

      <FilterBar
        activeTimeFilter={activeTimeFilter}
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        optionFilter={optionFilter}
        activeLocationSlug={locationSlug}
        activeLocationLabel={activeLocationLabel}
        locationOptions={locationOptions}
        visiblePlacesCount={visiblePlaces.length}
        visibleEventsCount={visibleEventsCount}
        availableOptionChips={availableOptionChips}
        countryOptions={civicCountryCounts}
        activeCountry={countryFilter}
        onCountryChange={setCountryFilter}
        isMobile={isMobile}
        searchIndex={searchIndex}
        onPickEvent={handleSearchPickEvent}
        onPickPlace={handleSearchPickPlace}
        onPickCategory={setActiveCategory}
        onUseMyLocation={handleUseMyLocation}
        onTimeFilterChange={setActiveTimeFilter}
        onCategoryChange={setActiveCategory}
        onSearchQueryChange={setSearchQuery}
        onOptionFilterChange={setOptionFilter}
        onLocationChange={handleLocationChange}
        onReset={handleResetFilters}
      />

      <MapResultsSheet
        events={sheetEvents}
        places={sheetPlaces}
        hidden={isLoading || keyboardOpen || !!selectedCivicEvent || !!selectedPlace || hasNoResults}
        onPickEvent={selectCivicEventById}
        onPickPlace={selectPlaceById}
      />

      {hasNoResults && !keyboardOpen && (
        <div className="pointer-events-none absolute inset-x-3 bottom-[4.75rem] z-20 md:left-4 md:bottom-4 md:w-[380px]">
          <div className="pointer-events-auto rounded-3xl border border-white/10 bg-ink-950/92 p-4 text-white shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">
              {t('map_no_results_title')}
            </p>
            <p className="mt-1 text-sm leading-6 text-white/60">
              {t('map_no_results_sub')}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/75">
                {getTimeFilterLabel(activeTimeFilter, t)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium capitalize text-white/75">
                {activeCategory === 'all' ? t('filter_all') : categoryLabel(activeCategory, t)}
              </span>
              {optionFilter !== 'all' && (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/75">
                  {optionFilter}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
            >
              {t('map_reset_filters')}
            </button>
          </div>
        </div>
      )}

      {selectedCivicEvent && (
        <div className="pointer-events-none absolute inset-x-3 bottom-[4.75rem] z-30 md:inset-x-auto md:bottom-4 md:left-4 md:w-[400px]">
          <MapEventCard
            key={selectedCivicEvent.id}
            event={selectedCivicEvent}
            cityLabel={selectedCivicCity}
            isAuthenticated={isAuth}
            initialSaved={savedIds.has(selectedCivicEvent.id)}
            onClose={closeCivicPopup}
          />
        </div>
      )}

      {/* key: remount on place change so per-place UI state (drag offsets)
          resets naturally instead of via a state-reset effect. */}
      <PlacePanel
        key={selectedPlace?.id ?? 'none'}
        place={selectedPlace}
        events={selectedPlaceEvents}
        isMobile={isMobile}
        onClose={() => setSelectedPlaceId(null)}
      />
    </div>
  )
}