'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Calendar, Clock3, Flame, MapPin, Users, X } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'

import { createMaplibreAdapter } from '@/components/map/maplibreAdapter'
import type { MapAdapter, MapMarkerInput } from '@/components/map/map.types'

export type ProtestMarker = {
  id: string
  name: string
  city: string
  country: string
  lat: number
  lng: number
  slug: string
  // Lightweight info shown in the on-map popup so the user can skim without
  // navigating away.
  date: string
  time: string
  expectedAttendees: number | null
}

type Props = {
  markers: ProtestMarker[]
  /**
   * When provided AND there are no markers to fit, the map flies to this point.
   * Useful when the user has searched a city that doesn't have any protest yet.
   */
  flyTo?: { lat: number; lng: number; label?: string } | null
  /** Initial map center [lng, lat] when there are no markers. Defaults to Tirana. */
  defaultCenter?: [number, number]
  /** Initial zoom when there are no markers. Defaults to 5.5 (regional). */
  defaultZoom?: number
}

// Marker class kept in lockstep with MapView.getMarkerClassName so /protests
// and /map render visually identical pins. If you tweak one, tweak the other.
function getProtestMarkerClassName(isSelected: boolean) {
  return [
    'rounded-full border px-3.5 py-2 text-xs font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 origin-bottom cursor-pointer',
    'hover:-translate-y-0.5 hover:scale-[1.03]',
    isSelected
      ? 'border-flame-400/50 bg-flame-500 text-white shadow-[0_14px_40px_rgba(238,28,37,0.55)] scale-110'
      : 'border-flame-500/30 bg-ink-950/90 text-flame-100 hover:border-flame-400/60 hover:bg-flame-500/15',
  ].join(' ')
}

function computeCenter(
  markers: ProtestMarker[],
  fallback: [number, number],
): [number, number] {
  if (markers.length === 0) return fallback
  const lat = markers.reduce((sum, m) => sum + m.lat, 0) / markers.length
  const lng = markers.reduce((sum, m) => sum + m.lng, 0) / markers.length
  return [lng, lat]
}

function formatAttendees(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}

export default function ProtestMap({
  markers,
  flyTo,
  defaultCenter = [19.8187, 41.3275],
  defaultZoom = 5.5,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapterRef = useRef<MapAdapter | null>(null)
  const [selected, setSelected] = useState<ProtestMarker | null>(null)
  // Mirror selected into a ref so the adapter's onMapClick callback (closed
  // over once at mount) can read the latest state without forcing a re-init.
  const selectedRef = useRef<ProtestMarker | null>(null)
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])
  // Markers ref so the close-handlers (which run after a click, not on every
  // render) can refit against the latest set without going stale.
  const markersRef = useRef<ProtestMarker[]>(markers)
  useEffect(() => {
    markersRef.current = markers
  }, [markers])
  const flyToRef = useRef(flyTo)
  useEffect(() => {
    flyToRef.current = flyTo
  }, [flyTo])

  // Snap back to the world-view (or geocoded fallback) the user came in with.
  // Called when the popup is dismissed via X or by tapping the map background.
  const resetView = () => {
    const adapter = adapterRef.current
    if (!adapter) return
    const current = markersRef.current
    if (current.length > 0) {
      adapter.fitBounds(
        current.map((m) => [m.lng, m.lat] as [number, number]),
        { padding: 80, maxZoom: current.length === 1 ? 10 : 5.5 },
      )
    } else if (flyToRef.current) {
      adapter.flyToLocation([flyToRef.current.lng, flyToRef.current.lat], 9)
    }
  }

  const closePopup = () => {
    setSelected(null)
    resetView()
  }

  useEffect(() => {
    if (!containerRef.current || adapterRef.current) return
    adapterRef.current = createMaplibreAdapter({
      container: containerRef.current,
      center: computeCenter(markers, defaultCenter),
      zoom: markers.length > 4 ? Math.max(defaultZoom - 2, 1.2) : defaultZoom,
      // Background click closes any open popup; a pin click stops propagation
      // so this never fires for the pin itself.
      onMapClick: () => {
        if (selectedRef.current) closePopup()
      },
      getMarkerClassName: getProtestMarkerClassName,
    })
    return () => {
      adapterRef.current?.destroy()
      adapterRef.current = null
    }
    // markers only used for initial center; subsequent setMarkers below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const adapter = adapterRef.current
    if (!adapter) return
    const inputs: MapMarkerInput[] = markers.map((m) => ({
      id: m.id,
      name: m.name,
      lat: m.lat,
      lng: m.lng,
      eventCount: 1,
      isSelected: selected?.id === m.id,
      hasHighlight: true,
      onClick: () => {
        setSelected(m)
        adapter.flyToLocation([m.lng, m.lat], Math.max(adapter ? 7 : 5, 7))
      },
    }))
    adapter.setMarkers(inputs)
  }, [markers, selected])

  // Refit the map whenever the set of markers changes (e.g. filter applied).
  // When there are no markers but the parent provided a geocoded flyTo target,
  // fly the map there so the user still sees "their" city.
  useEffect(() => {
    const adapter = adapterRef.current
    if (!adapter) return
    if (markers.length > 0) {
      adapter.fitBounds(
        markers.map((m) => [m.lng, m.lat] as [number, number]),
        { padding: 80, maxZoom: markers.length === 1 ? 10 : 5.5 },
      )
    } else if (flyTo) {
      adapter.flyToLocation([flyTo.lng, flyTo.lat], 9)
    }
  }, [markers, flyTo])

  // If the filter strips the currently-selected pin away (e.g. the user
  // changes country chip), drop the popup so it doesn't dangle.
  useEffect(() => {
    if (selected && !markers.find((m) => m.id === selected.id)) {
      setSelected(null)
    }
  }, [markers, selected])

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
      <div ref={containerRef} className="aspect-[4/5] w-full sm:aspect-[2/1]" />

      {/* When the filter yields zero markers but the user has searched a city,
          show a small "no protest yet here" pin overlay over the geocoded spot. */}
      {markers.length === 0 && flyTo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-flame-500/30 bg-ink-950/85 backdrop-blur px-4 py-3 text-center shadow-2xl max-w-xs">
            <p className="text-xs uppercase tracking-wider text-flame-400/80">No protest yet</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {flyTo.label ?? 'Here'}
            </p>
            <p className="mt-1 text-[11px] text-white/55">Scroll down to register the first one.</p>
          </div>
        </div>
      )}

      {selected && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3 sm:top-5">
          <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-flame-500/40 bg-ink-950/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <button
              type="button"
              aria-label="Close"
              onClick={closePopup}
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 transition hover:bg-white/[0.12] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-flame-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-flame-300 ring-1 ring-flame-500/30">
                  <Flame className="h-3 w-3" />
                  Civic
                </span>
                {selected.expectedAttendees != null && selected.expectedAttendees > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/75">
                    <Users className="h-3 w-3" />
                    {formatAttendees(selected.expectedAttendees)} expected
                  </span>
                )}
              </div>

              <h3 className="mt-3 pr-7 text-sm font-semibold leading-snug text-white">
                {selected.name}
              </h3>

              <div className="mt-3 space-y-1.5 text-[12px] text-white/65">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-white/45" />
                  <span>{selected.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 text-white/45" />
                  <span>{selected.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-white/45" />
                  <span className="truncate">
                    {selected.city}
                    {selected.country ? `, ${selected.country}` : ''}
                  </span>
                </div>
              </div>

              <Link
                href={`/events/${selected.slug}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white shadow-glow-flame transition hover:bg-flame-400"
              >
                Open event
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 bottom-4 flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/70 backdrop-blur px-3 py-1.5 text-[11px] text-white/65">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-flame-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-flame-500" />
        </span>
        {markers.length > 0 ? 'Active peaceful gathering' : 'Browsing the map'}
      </div>
    </div>
  )
}
