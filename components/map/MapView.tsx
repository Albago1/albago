'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

import { events } from '@/data/events'
import { places } from '@/data/places'
import FilterBar from '@/components/layout/FilterBar'
import PlacePanel from '@/components/place/PlacePanel'
import { Place } from '@/types/place'
import { createMaplibreAdapter } from '@/components/map/maplibreAdapter'
import type { MapAdapter, MapMarkerInput } from '@/components/map/map.types'

type TimeFilter = 'all' | 'tonight' | 'weekend'

function getMarkerClassName(isSelected: boolean) {
  return [
    'rounded-full border px-3 py-1 text-xs font-semibold shadow-md transition-all duration-150 origin-bottom cursor-pointer',
    isSelected
      ? 'border-black bg-white text-black shadow-lg'
      : 'border-transparent bg-black text-white hover:bg-gray-800 hover:shadow-lg hover:ring-2 hover:ring-black/10',
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

export default function MapView() {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapAdapterRef = useRef<MapAdapter | null>(null)

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('all')
  const [activeCategory, setActiveCategory] = useState('all')
  const [isMobile, setIsMobile] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    setHasHydrated(true)
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

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (activeTimeFilter === 'all') return true
      if (activeTimeFilter === 'tonight') return event.date === '2026-04-03'
      if (activeTimeFilter === 'weekend') {
        return ['2026-04-03', '2026-04-04', '2026-04-05'].includes(event.date)
      }
      return true
    })
  }, [activeTimeFilter])

  const visiblePlaces = useMemo(() => {
    const placeIdsWithEvents = new Set(filteredEvents.map(event => event.placeId))

    return places.filter(place => {
      const categoryMatch =
        activeCategory === 'all' || place.category === activeCategory

      const timeMatch =
        activeTimeFilter === 'all' ? true : placeIdsWithEvents.has(place.id)

      return categoryMatch && timeMatch
    })
  }, [activeCategory, activeTimeFilter, filteredEvents])

  const visiblePlaceIds = useMemo(() => {
    return new Set(visiblePlaces.map(place => place.id))
  }, [visiblePlaces])

  const visibleEventsCount = useMemo(() => {
    return filteredEvents.filter(event => visiblePlaceIds.has(event.placeId)).length
  }, [filteredEvents, visiblePlaceIds])

  const selectedPlace = useMemo<Place | null>(() => {
    return places.find(place => place.id === selectedPlaceId) ?? null
  }, [selectedPlaceId])

  const hasNoResults = visiblePlaces.length === 0

  useEffect(() => {
    if (!mapRef.current || mapAdapterRef.current) return

    mapAdapterRef.current = createMaplibreAdapter({
      container: mapRef.current,
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

    const markerInputs: MapMarkerInput[] = visiblePlaces.map(place => ({
      id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      isSelected: place.id === selectedPlaceId,
      onClick: () => setSelectedPlaceId(place.id),
    }))

    adapter.setMarkers(markerInputs)
  }, [visiblePlaces, selectedPlaceId])

  useEffect(() => {
    if (!selectedPlaceId) return

    const stillVisible = visiblePlaces.some(place => place.id === selectedPlaceId)

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
    ? filteredEvents.filter(event => event.placeId === selectedPlace.id)
    : []

  const handleResetFilters = () => {
    setActiveTimeFilter('all')
    setActiveCategory('all')
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div ref={mapRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)]">
        <div className="pointer-events-auto rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
          <h1 className="text-lg font-bold text-gray-900">AlbaGo</h1>
          <p className="text-sm text-gray-600">
            Discover where to go tonight in Tirana
          </p>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-50 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
        {hasHydrated ? 'JS running' : 'No JS'}
      </div>

      <FilterBar
        activeTimeFilter={activeTimeFilter}
        activeCategory={activeCategory}
        visiblePlacesCount={visiblePlaces.length}
        visibleEventsCount={visibleEventsCount}
        onTimeFilterChange={setActiveTimeFilter}
        onCategoryChange={setActiveCategory}
        onReset={handleResetFilters}
      />

      {hasNoResults && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 md:left-4 md:bottom-4 md:w-[380px]">
          <div className="pointer-events-auto rounded-2xl bg-white/95 p-4 shadow-2xl backdrop-blur">
            <p className="text-sm font-semibold text-gray-900">
              No places match these filters
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Try another time or category to see more places and events in Tirana.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {getTimeFilterLabel(activeTimeFilter)}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-700">
                {getCategoryLabel(activeCategory)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
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