'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Globe, Loader2, Search, X } from 'lucide-react'

export type ResolvedCity = {
  slug: string
  city: string
  country: string
  lat: number
  lng: number
  displayName: string
}

export type PopularCity = {
  slug: string
  label: string
  country: string
  lat: number
  lng: number
}

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  onResolve: (resolved: ResolvedCity | null) => void
  resolved: ResolvedCity | null
  placeholder?: string
  popular?: PopularCity[]
  onPopularClick?: (item: ResolvedCity) => void
  className?: string
  /** Cap dropdown suggestions; 0 to disable suggestions UI entirely. */
  suggestionsLimit?: number
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

type NominatimHit = {
  lat: string
  lon: string
  display_name: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    state?: string
    country?: string
  }
}

function hitToResolved(hit: NominatimHit): ResolvedCity {
  const a = hit.address ?? {}
  const city = a.city || a.town || a.village || a.municipality || ''
  const country = a.country || ''
  const cityName = city || hit.display_name.split(',')[0]?.trim() || hit.display_name
  return {
    slug: slugify(city || cityName) || 'unknown',
    city: cityName,
    country,
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    displayName: hit.display_name,
  }
}

export default function CitySearchInput(props: Props) {
  const {
    id,
    value,
    onChange,
    onResolve,
    resolved,
    placeholder = 'Search any city...',
    popular,
    onPopularClick,
    className,
    suggestionsLimit = 5,
  } = props

  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<ResolvedCity[]>([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Debounced Nominatim search. Loads the suggestion list — does NOT
  // auto-apply the first hit. Auto-resolving on every keystroke was
  // hijacking the picker (e.g. typing 'T' would Nominatim → Tirana →
  // navigate to /map?location=tirana, then every further keystroke
  // re-fired the same logic and you were locked into Tirana). Same fix
  // already shipped in LocationAutocomplete.tsx — applies here too.
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
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${Math.max(1, suggestionsLimit || 1)}&addressdetails=1`
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          setSuggestions([])
          return
        }
        const hits = (await res.json()) as NominatimHit[]
        const mapped = Array.isArray(hits) ? hits.map(hitToResolved) : []
        setSuggestions(mapped)
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
    // onResolve intentionally excluded — see comment above; it's only called
    // when the user clicks a suggestion or a popular chip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, suggestionsLimit])

  const clear = () => {
    onChange('')
    onResolve(null)
    setSuggestions([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const handlePopular = (item: PopularCity) => {
    const r: ResolvedCity = {
      slug: item.slug,
      city: item.label,
      country: item.country,
      lat: item.lat,
      lng: item.lng,
      displayName: `${item.label}, ${item.country}`,
    }
    onChange(item.label)
    onResolve(r)
    setSuggestions([])
    setOpen(false)
    onPopularClick?.(r)
  }

  // Show as soon as Nominatim returns anything — a single hit used to be
  // hidden, which combined with the removed auto-resolve would leave the
  // user with no way to actually pick it.
  const showSuggestions = open && suggestions.length > 0 && suggestionsLimit > 0

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
          className="h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-white/20"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/35" />
        )}
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {suggestions.slice(0, suggestionsLimit).map((s, idx) => (
              <button
                key={`${s.slug}-${idx}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(s.city || s.displayName.split(',')[0])
                  onResolve(s)
                  setOpen(false)
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-white/85 transition hover:bg-white/[0.06]"
              >
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {s.city || s.displayName.split(',')[0]}
                    {s.country && (
                      <span className="ml-1 text-white/45">— {s.country}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-white/45">
                    {s.displayName}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {resolved && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 text-sm text-emerald-100">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <div className="min-w-0">
            <p className="font-medium">
              {resolved.city || resolved.displayName.split(',')[0]?.trim()}
              {resolved.country && `, ${resolved.country}`}
            </p>
            <p className="font-mono text-[11px] text-emerald-100/70">
              {resolved.lat.toFixed(4)}, {resolved.lng.toFixed(4)} · slug:{' '}
              {resolved.slug}
            </p>
          </div>
        </div>
      )}

      {!resolved && value.trim().length >= 2 && !loading && suggestions.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55">
          No city matched. Try a more specific name (e.g. &ldquo;Berlin, Germany&rdquo;).
        </p>
      )}

      {popular && popular.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="self-center text-[11px] uppercase tracking-wide text-white/35">
            Popular:
          </span>
          {popular.slice(0, 12).map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => handlePopular(item)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/75 transition hover:bg-white/[0.08] hover:text-white"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export { slugify as slugifyCity }
