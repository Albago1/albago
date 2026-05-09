'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import 'maplibre-gl/dist/maplibre-gl.css'

import FilterBar from '@/components/layout/FilterBar'
import PlacePanel from '@/components/place/PlacePanel'
import type { Place } from '@/types/place'
import type { Event } from '@/types/event'
import { createMaplibreAdapter } from '@/components/map/maplibreAdapter'
import type { MapAdapter, MapMarkerInput } from '@/components/map/map.types'
import { isToday, isThisWeekend } from '@/lib/dateFilters'
import { createClient } from '@/lib/supabase/browser'
import { getLocationBySlug, locations } from '@/lib/locations'
import { useLocations } from '@/lib/useLocations'

type TimeFilter = 'all' | 'tonight' | 'weekend'

function getMarkerClassName(isSelected: boolean) {
  return [
    'rounded-full border px-3.5 py-2 text-xs font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-200 origin-bottom cursor-pointer',
    'hover:-translate-y-0.5 hover:scale-[1.03]',
    isSelected
      ? 'border-white/20 bg-white text-black shadow-[0_14px_40px_rgba(255,255,255,0.18)] scale-110'
      : 'border-white/10 bg-[#070b14]/90 text-white hover:border-white/20 hover:bg-[#111827]/95',
  ].join(' ')
}

function getTimeFilterLabel(filter: TimeFilter) {
  if (filter === 'all') return 'All'
  if (filter === 'tonight') return 'Tonight'
  return 'This weekend'
}

function getCategoryLabel(category: string) {
  if (category === 'all') return 'All'
  return category
}

function getValidTimeFilter(value: string | null): TimeFilter {
  if (value === 'tonight' || value === 'weekend') return value
  return 'all'
}

export default function MapView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locationOptions = useLocations()

  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapAdapterRef = useRef<MapAdapter | null>(null)

  const locationSlug = searchParams.get('location') || 'tirana'
  const location = getLocationBySlug(locationSlug)

  const initialCategory = searchParams.get('category') || 'all'
  const initialPlaceId = searchParams.get('place')
  const initialTimeFilter = getValidTimeFilter(searchParams.get('time'))

  const [places, setPlaces] = useState<Place[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialPlaceId)
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>(initialTimeFilter)
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [searchQuery, setSearchQuery] = useState('')
  const [optionFilter, setOptionFilter] = useState('all')
  const [isMobile, setIsMobile] = useState(false)

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
      const [placesRes, eventsRes] = await Promise.all([
        supabase.from('places').select('*').eq('location_slug', locationSlug),
        supabase.from('events').select('*').eq('status', 'published').eq('location_slug', locationSlug),
      ])

      if (placesRes.data) {
        setPlaces(placesRes.data.map((p) => ({
          id: p.id,
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
        setEvents(eventsRes.data.map((e) => ({
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
      setIsLoading(false)
    }

    fetchData()
  }, [locationSlug])

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

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (activeTimeFilter === 'all') return true
      if (activeTimeFilter === 'tonight') return isToday(event.date)
      if (activeTimeFilter === 'weekend') return isThisWeekend(event.date)
      return true
    })
  }, [activeTimeFilter, events])

  const availableOptionChips = useMemo(() => {
    const allOptions = places.flatMap((place) => place.options ?? [])
    return [...new Set(allOptions)]
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 12)
  }, [places])

  const visiblePlaces = useMemo(() => {
    const placeIdsWithEvents = new Set(filteredEvents.map((event) => event.placeId))
    const normalizedSearch = searchQuery.trim().toLowerCase()

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
        place.name.toLowerCase().includes(normalizedSearch) ||
        place.description.toLowerCase().includes(normalizedSearch) ||
        place.category.toLowerCase().includes(normalizedSearch) ||
        place.options?.some((option) =>
          option.toLowerCase().includes(normalizedSearch)
        )

      return categoryMatch && timeMatch && optionMatch && searchMatch
    })
  }, [activeCategory, activeTimeFilter, filteredEvents, optionFilter, searchQuery])

  const visiblePlaceIds = useMemo(() => {
    return new Set(visiblePlaces.map((place) => place.id))
  }, [visiblePlaces])

  const visibleEventsCount = useMemo(() => {
    return filteredEvents.filter((event) => event.placeId != null && visiblePlaceIds.has(event.placeId)).length
  }, [filteredEvents, visiblePlaceIds])

  const selectedPlace = useMemo<Place | null>(() => {
    return places.find((place) => place.id === selectedPlaceId) ?? null
  }, [selectedPlaceId, places])

  const hasNoResults = !isLoading && visiblePlaces.length === 0

  useEffect(() => {
    if (!mapRef.current || mapAdapterRef.current) return

    mapAdapterRef.current = createMaplibreAdapter({
      container: mapRef.current,
      center: location.center,
      zoom: location.zoom,
      onMapClick: () => setSelectedPlaceId(null),
      getMarkerClassName,
    })

    return () => {
      mapAdapterRef.current?.destroy()
      mapAdapterRef.current = null
    }
  }, [])

  useEffect(() => {
    const adapter = mapAdapterRef.current
    if (!adapter) return

    const markerInputs: MapMarkerInput[] = visiblePlaces.map((place) => {
      const placeEvents = filteredEvents.filter((event) => event.placeId === place.id)

      return {
        id: place.id,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        category: place.category,
        eventCount: placeEvents.length,
        hasHighlight: placeEvents.some((event) => event.highlight),
        isSelected: place.id === selectedPlaceId,
        onClick: () => setSelectedPlaceId(place.id),
      }
    })

    adapter.setMarkers(markerInputs)
    }, [visiblePlaces, selectedPlaceId, filteredEvents])

  useEffect(() => {
    if (!selectedPlaceId) return

    const stillVisible = visiblePlaces.some((place) => place.id === selectedPlaceId)

    if (!stillVisible) {
      setSelectedPlaceId(null)
    }
  }, [selectedPlaceId, visiblePlaces])

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

  const handleResetFilters = () => {
    setActiveTimeFilter('all')
    setActiveCategory('all')
    setSearchQuery('')
    setOptionFilter('all')
  }

  const handleLocationChange = (slug: string) => {
    const params = new URLSearchParams()
    params.set('location', slug)
    if (activeTimeFilter !== 'all') params.set('time', activeTimeFilter)
    if (activeCategory !== 'all') params.set('category', activeCategory)
    router.replace(`/map?${params.toString()}`)
  }

  useEffect(() => {
    const adapter = mapAdapterRef.current
    if (!adapter) return
    adapter.flyToLocation(location.center, location.zoom)
  }, [locationSlug])

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#070b14]">
      <div ref={mapRef} className="h-full w-full" />

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-2xl border border-white/10 bg-[#070b14]/80 px-5 py-3 text-sm text-white/60 backdrop-blur-xl">
            Loading places...
          </div>
        </div>
      )}

      <FilterBar
        activeTimeFilter={activeTimeFilter}
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        optionFilter={optionFilter}
        activeLocationSlug={locationSlug}
        locationOptions={locationOptions}
        visiblePlacesCount={visiblePlaces.length}
        visibleEventsCount={visibleEventsCount}
        availableOptionChips={availableOptionChips}
        isMobile={isMobile}
        onTimeFilterChange={setActiveTimeFilter}
        onCategoryChange={setActiveCategory}
        onSearchQueryChange={setSearchQuery}
        onOptionFilterChange={setOptionFilter}
        onLocationChange={handleLocationChange}
        onReset={handleResetFilters}
      />

      {hasNoResults && (
        <div className="pointer-events-none absolute inset-x-3 bottom-4 z-20 md:left-4 md:bottom-4 md:w-[380px]">
          <div className="pointer-events-auto rounded-3xl border border-white/10 bg-[#070b14]/92 p-4 text-white shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">
              No places match these filters
            </p>
            <p className="mt-1 text-sm leading-6 text-white/60">
              Try another search, time, category, or tag to see more places and
              events in {location.label}.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/75">
                {getTimeFilterLabel(activeTimeFilter)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium capitalize text-white/75">
                {getCategoryLabel(activeCategory)}
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
              Reset filters
            </button>
          </div>
        </div>
      )}

      <PlacePanel
        place={selectedPlace}
        events={selectedPlaceEvents}
        isMobile={isMobile}
        onClose={() => setSelectedPlaceId(null)}
      />
    </div>
  )
}