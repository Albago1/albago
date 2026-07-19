'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Check, Globe, Loader2, MapPin, Search, X } from 'lucide-react'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export type ResolvedAddress = {
  slug: string
  city: string | null
  country: string | null
  countryCode: string | null
  region: string | null
  address: string | null
  road: string | null
  houseNumber: string | null
  postcode: string | null
  displayName: string
  lat: number
  lng: number
  placeId: number | string
  type: string | null
}

type ApiSuggestion = ResolvedAddress
type ApiForwardResponse = { suggestions: ApiSuggestion[] }
type ApiReverseResponse = { result: ApiSuggestion | null }

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  onResolve: (resolved: ResolvedAddress | null) => void
  resolved: ResolvedAddress | null
  placeholder?: string
  className?: string
  /** Show the mini-map preview. Default true. */
  showMap?: boolean
  /** Tailwind height class for the map; default h-56 (~14rem). */
  mapHeightClass?: string
  /** Mark this field as required for accessibility. */
  required?: boolean
  /** Suggestions cap. 0 disables the dropdown UI but still resolves the top hit. */
  suggestionsLimit?: number
}

export default function LocationAutocomplete(props: Props) {
  const {
    id,
    value,
    onChange,
    onResolve,
    resolved,
    placeholder = 'Search any place, address, or city...',
    className,
    showMap = true,
    mapHeightClass = 'h-56',
    required,
    suggestionsLimit = 5,
  } = props

  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<ApiSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  // --- Forward search (debounced) ----------------------------------------

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      setSuggestions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}&limit=${suggestionsLimit || 5}`,
          { signal: ctrl.signal },
        )
        if (!res.ok) {
          setSuggestions([])
          return
        }
        const payload = (await res.json()) as ApiForwardResponse
        const list = payload.suggestions ?? []
        setSuggestions(list)
        // Do NOT auto-resolve to list[0]. The user must explicitly click a
        // suggestion, click the map, or drag the pin to set `resolved`.
        // Auto-resolving on every keystroke was overwriting deliberate picks
        // and snapping the map back to a stale "top hit" mid-typing.
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [value, suggestionsLimit])

  // --- Mini-map setup ----------------------------------------------------

  useEffect(() => {
    if (!showMap) return
    if (mapRef.current) return
    const el = mapContainerRef.current
    if (!el) return

    const map = new maplibregl.Map({
      container: el,
      style: MAP_STYLE,
      center: resolved ? [resolved.lng, resolved.lat] : [19.8187, 41.3275],
      zoom: resolved ? 14 : 9,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')

    // Click anywhere to drop pin + reverse geocode.
    map.on('click', async (e) => {
      const lat = e.lngLat.lat
      const lng = e.lngLat.lng
      placePin(lng, lat)
      await reverseGeocode(lng, lat)
    })

    if (resolved) placePin(resolved.lng, resolved.lat)

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // Intentionally only run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap])

  // Reflect external `resolved` changes into the map (e.g. user picked a
  // suggestion in the dropdown).
  useEffect(() => {
    if (!showMap) return
    const map = mapRef.current
    if (!map) return
    if (!resolved) return
    placePin(resolved.lng, resolved.lat)
    map.flyTo({ center: [resolved.lng, resolved.lat], zoom: 14, duration: 600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved?.lat, resolved?.lng, showMap])

  function placePin(lng: number, lat: number) {
    const map = mapRef.current
    if (!map) return

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat])
      return
    }

    const el = document.createElement('div')
    el.className =
      'flex h-9 w-9 -translate-y-2 items-center justify-center rounded-full border-2 border-white bg-flame-500 text-white shadow-[0_8px_24px_rgba(238,28,37,0.55)] cursor-grab active:cursor-grabbing'
    el.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'

    const marker = new maplibregl.Marker({
      element: el,
      draggable: true,
      anchor: 'bottom',
    })
      .setLngLat([lng, lat])
      .addTo(map)

    marker.on('dragend', async () => {
      const ll = marker.getLngLat()
      await reverseGeocode(ll.lng, ll.lat)
    })

    markerRef.current = marker
  }

  async function reverseGeocode(lng: number, lat: number) {
    try {
      const res = await fetch(
        `/api/geocode?reverse=1&lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`,
      )
      if (!res.ok) return
      const payload = (await res.json()) as ApiReverseResponse
      if (payload.result) {
        onResolve(payload.result)
        // Update the text input to the user-friendly bit.
        const display =
          payload.result.address ||
          payload.result.city ||
          payload.result.displayName.split(',')[0]?.trim() ||
          payload.result.displayName
        onChange(display)
      } else {
        onResolve({
          slug: 'unknown',
          city: null,
          country: null,
          countryCode: null,
          region: null,
          address: null,
          road: null,
          houseNumber: null,
          postcode: null,
          displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          lat,
          lng,
          placeId: `${lat},${lng}`,
          type: null,
        })
      }
    } catch {
      /* swallow */
    }
  }

  // --- Render -----------------------------------------------------------

  const showSuggestions = open && suggestions.length > 0 && suggestionsLimit > 0

  const clear = () => {
    onChange('')
    onResolve(null)
    setSuggestions([])
    setOpen(false)
    markerRef.current?.remove()
    markerRef.current = null
    inputRef.current?.focus()
  }

  return (
    <div className={['space-y-2', className].filter(Boolean).join(' ')}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          required={required}
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-white/20"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/35" />
        )}
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear location"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {suggestions.slice(0, suggestionsLimit).map((s, idx) => {
              const headline =
                s.address ||
                s.city ||
                s.displayName.split(',')[0]?.trim() ||
                s.displayName
              return (
                <button
                  key={`${s.placeId}-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(headline)
                    onResolve(s)
                    setOpen(false)
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-white/85 transition hover:bg-white/[0.06]"
                >
                  <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{headline}</span>
                    <span className="block truncate text-xs text-white/45">
                      {s.displayName}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {resolved && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 text-sm text-emerald-100">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <div className="min-w-0">
            <p className="font-medium">
              {resolved.address ||
                resolved.city ||
                resolved.displayName.split(',')[0]?.trim()}
              {resolved.city && resolved.address && (
                <span className="text-emerald-100/70">, {resolved.city}</span>
              )}
              {resolved.country && <span className="text-emerald-100/70">, {resolved.country}</span>}
            </p>
            <p className="truncate font-mono text-[11px] text-emerald-100/70">
              {resolved.lat.toFixed(4)}, {resolved.lng.toFixed(4)}
              {resolved.postcode && ` · ${resolved.postcode}`}
              {' · slug: '}
              {resolved.slug}
            </p>
          </div>
        </div>
      )}

      {!resolved && value.trim().length >= 2 && !loading && suggestions.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55">
          No match. Try a more specific place (e.g. &ldquo;Brandenburg Gate, Berlin&rdquo;).
        </p>
      )}

      {showMap && (
        <div
          className={[
            'overflow-hidden rounded-2xl border border-white/10 bg-ink-950',
            mapHeightClass,
          ].join(' ')}
        >
          <div ref={mapContainerRef} className="h-full w-full" />
          <p className="pointer-events-none absolute mt-[-1.75rem] ml-3 inline-flex items-center gap-1 rounded-full bg-ink-950/80 px-2 py-0.5 text-[10px] text-white/55 backdrop-blur">
            <MapPin className="h-3 w-3" /> Drag the pin to fine-tune, or click anywhere
          </p>
        </div>
      )}
    </div>
  )
}
