'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

function getProtestMarkerClassName(isSelected: boolean) {
  return [
    'rounded-full border px-3.5 py-2 text-xs font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 origin-bottom cursor-pointer',
    'hover:-translate-y-0.5 hover:scale-[1.03]',
    isSelected
      ? 'border-flame-400/40 bg-flame-500 text-white shadow-[0_14px_40px_rgba(238,28,37,0.55)] scale-110'
      : 'border-flame-500/40 bg-[#0a0a0b]/90 text-flame-200 hover:border-flame-400/70 hover:bg-flame-500/15',
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

export default function ProtestMap({
  markers,
  flyTo,
  defaultCenter = [19.8187, 41.3275],
  defaultZoom = 5.5,
}: Props) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapterRef = useRef<MapAdapter | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || adapterRef.current) return
    adapterRef.current = createMaplibreAdapter({
      container: containerRef.current,
      center: computeCenter(markers, defaultCenter),
      zoom: markers.length > 4 ? Math.max(defaultZoom - 2, 1.2) : defaultZoom,
      onMapClick: () => setSelectedId(null),
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
      name: m.city,
      lat: m.lat,
      lng: m.lng,
      isSelected: m.id === selectedId,
      hasHighlight: true,
      onClick: () => setSelectedId((prev) => (prev === m.id ? null : m.id)),
    }))
    adapter.setMarkers(inputs)
  }, [markers, selectedId])

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

  const selected = markers.find((m) => m.id === selectedId) ?? null

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
      <div ref={containerRef} className="aspect-[2/1] w-full" />

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

      <div className="pointer-events-none absolute left-4 bottom-4 flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/70 backdrop-blur px-3 py-1.5 text-[11px] text-white/65">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-flame-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-flame-500" />
        </span>
        {markers.length > 0 ? 'Active peaceful gathering' : 'Browsing the map'}
      </div>

      {selected && (
        <div className="absolute right-4 bottom-4 max-w-xs rounded-2xl border border-white/15 bg-ink-950/95 backdrop-blur p-4 shadow-2xl">
          <p className="text-xs uppercase tracking-wider text-flame-400/80">{selected.country}</p>
          <p className="mt-1 font-semibold text-white">{selected.city}</p>
          <p className="mt-1 text-sm text-white/65 line-clamp-2">{selected.name}</p>
          <button
            type="button"
            onClick={() => router.push(`/events/${selected.slug}`)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-flame-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-flame-400 transition"
          >
            Open event
          </button>
        </div>
      )}
    </div>
  )
}
