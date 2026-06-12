'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

// A pin on the /protests map represents a CITY, not an individual event — same
// presentation as MapView's place pins (city/place label + count badge). When
// multiple protests share a city, they collapse into one pin and the corner
// panel lists each individually on selection.
type CityGroup = {
  key: string
  city: string
  country: string
  lat: number
  lng: number
  events: ProtestMarker[]
}

// Marker class: kept in lockstep with MapView.getMarkerClassName so /protests
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
  groups: CityGroup[],
  fallback: [number, number],
): [number, number] {
  if (groups.length === 0) return fallback
  const lat = groups.reduce((sum, g) => sum + g.lat, 0) / groups.length
  const lng = groups.reduce((sum, g) => sum + g.lng, 0) / groups.length
  return [lng, lat]
}

// Collapse protests at the same city into a single pin. Key is `city|country`
// lowercased so "Berlin / Germany" and "berlin / germany" merge but "Berlin /
// Germany" and "Berlin / Argentina" don't. Pin coords are the centroid of the
// group so a city with N pins lands roughly where you'd expect.
function groupByCity(markers: ProtestMarker[]): CityGroup[] {
  const map = new Map<string, CityGroup>()
  for (const m of markers) {
    const cityLabel = (m.city || '').trim() || 'Unknown'
    const key = `${cityLabel.toLowerCase()}|${(m.country || '').toLowerCase()}`
    const existing = map.get(key)
    if (existing) {
      existing.events.push(m)
      // Running centroid: weight new lat/lng equally with all prior.
      const n = existing.events.length
      existing.lat = existing.lat + (m.lat - existing.lat) / n
      existing.lng = existing.lng + (m.lng - existing.lng) / n
    } else {
      map.set(key, {
        key,
        city: cityLabel,
        country: m.country,
        lat: m.lat,
        lng: m.lng,
        events: [m],
      })
    }
  }
  return Array.from(map.values())
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const groups = useMemo(() => groupByCity(markers), [markers])

  useEffect(() => {
    if (!containerRef.current || adapterRef.current) return
    adapterRef.current = createMaplibreAdapter({
      container: containerRef.current,
      center: computeCenter(groups, defaultCenter),
      zoom: groups.length > 4 ? Math.max(defaultZoom - 2, 1.2) : defaultZoom,
      onMapClick: () => setSelectedKey(null),
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
    const inputs: MapMarkerInput[] = groups.map((g) => ({
      id: g.key,
      // City label only — matches what the user picked over event titles
      // (titles overflow the truncate window once they're 15+ chars).
      name: g.city,
      lat: g.lat,
      lng: g.lng,
      // Pass eventCount only when there are 2+ protests in the city. With 1,
      // the badge would just show "1" everywhere — visual noise — so we drop
      // it. The dot indicator alone is enough to read the pin.
      eventCount: g.events.length > 1 ? g.events.length : undefined,
      isSelected: g.key === selectedKey,
      hasHighlight: true,
      onClick: () => setSelectedKey((prev) => (prev === g.key ? null : g.key)),
    }))
    adapter.setMarkers(inputs)
  }, [groups, selectedKey])

  // Refit the map whenever the set of groups changes (e.g. filter applied).
  // When there are no markers but the parent provided a geocoded flyTo target,
  // fly the map there so the user still sees "their" city.
  useEffect(() => {
    const adapter = adapterRef.current
    if (!adapter) return
    if (groups.length > 0) {
      adapter.fitBounds(
        groups.map((g) => [g.lng, g.lat] as [number, number]),
        { padding: 80, maxZoom: groups.length === 1 ? 10 : 5.5 },
      )
    } else if (flyTo) {
      adapter.flyToLocation([flyTo.lng, flyTo.lat], 9)
    }
  }, [groups, flyTo])

  const selectedGroup = groups.find((g) => g.key === selectedKey) ?? null

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
      <div ref={containerRef} className="aspect-[4/5] w-full sm:aspect-[2/1]" />

      {/* When the filter yields zero markers but the user has searched a city,
          show a small "no protest yet here" pin overlay over the geocoded spot. */}
      {groups.length === 0 && flyTo && (
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
        {groups.length > 0 ? 'Active peaceful gathering' : 'Browsing the map'}
      </div>

      {selectedGroup && selectedGroup.events.length === 1 && (
        <div className="absolute right-4 bottom-4 max-w-xs rounded-2xl border border-white/15 bg-ink-950/95 backdrop-blur p-4 shadow-2xl">
          <p className="text-xs uppercase tracking-wider text-flame-400/80">{selectedGroup.country}</p>
          <p className="mt-1 font-semibold text-white">{selectedGroup.city}</p>
          <p className="mt-1 text-sm text-white/65 line-clamp-2">{selectedGroup.events[0].name}</p>
          <button
            type="button"
            onClick={() => router.push(`/events/${selectedGroup.events[0].slug}`)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-flame-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-flame-400 transition"
          >
            Open event
          </button>
        </div>
      )}

      {selectedGroup && selectedGroup.events.length > 1 && (
        <div className="absolute right-4 bottom-4 max-w-xs rounded-2xl border border-white/15 bg-ink-950/95 backdrop-blur p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-flame-400/80">{selectedGroup.country}</p>
              <p className="mt-1 font-semibold text-white">{selectedGroup.city}</p>
            </div>
            <span className="rounded-full bg-flame-500/15 px-2.5 py-1 text-[11px] font-bold text-flame-200 ring-1 ring-flame-500/30">
              {selectedGroup.events.length}
            </span>
          </div>
          <ul className="mt-3 max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {selectedGroup.events.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/events/${ev.slug}`)}
                  className="w-full text-left rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/80 ring-1 ring-white/[0.06] hover:bg-flame-500/10 hover:text-white hover:ring-flame-500/40 transition line-clamp-2"
                >
                  {ev.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
