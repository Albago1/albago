'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { MapPin, Search, Sparkles } from 'lucide-react'

type Suggestion = {
  road: string | null
  houseNumber: string | null
  postcode: string | null
  city: string | null
  country: string | null
  displayName: string
  placeId: number | string
}

type MapResultLike = {
  road: string | null
  houseNumber: string | null
  postcode: string | null
  city: string | null
  country: string | null
  displayName: string
} | null

type Props = {
  /** Current address text (driven from draft.address). */
  value: string
  /** Called when the submitter picks a suggestion or types in the textarea. */
  onChange: (next: string) => void
  /** Optional preset from the LocationAutocomplete map search above. Used as
   *  the "Use this address" chip — a one-click fill without typing again. */
  mapResult: MapResultLike
  placeholder?: string
  rows?: number
}

/**
 * Joins Nominatim address parts into a rich, geocoder-friendly string:
 *
 *   "Grünhofer Weg 42, 12169 Berlin, Germany"
 *
 * The order (street first, postcode+city next, country last) is the format
 * Google Maps reliably resolves to a named place across most countries.
 * Falls back to displayName when we don't have enough structured parts.
 */
function formatRichAddress(s: {
  road: string | null
  houseNumber: string | null
  postcode: string | null
  city: string | null
  country: string | null
  displayName: string
}): string {
  if (s.road) {
    const streetLine = s.houseNumber ? `${s.road} ${s.houseNumber}` : s.road
    const cityLine =
      s.postcode && s.city
        ? `${s.postcode} ${s.city}`
        : (s.city ?? s.postcode ?? '')
    return [streetLine, cityLine, s.country].filter(Boolean).join(', ')
  }
  return s.displayName
}

export default function AddressSearchField({
  value,
  onChange,
  mapResult,
  placeholder,
  rows = 2,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const skipNextFetchRef = useRef(false)

  // --- Live dropdown query ----------------------------------------------
  // Debounced — fires 300 ms after the user stops typing. Only runs when the
  // field is focused and the query is long enough to be meaningful.
  useEffect(() => {
    if (!isFocused) return
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }
    const q = value.trim()
    if (q.length < 3) {
      setSuggestions([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}&limit=6`,
          { cache: 'no-store' },
        )
        if (cancelled) return
        const data = await res.json()
        const arr = Array.isArray(data?.suggestions)
          ? (data.suggestions as Suggestion[])
          : []
        setSuggestions(arr)
      } catch {
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, isFocused])

  // --- Close-on-outside-click -------------------------------------------
  useEffect(() => {
    if (!isFocused) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [isFocused])

  // --- Quick-fill chip from the LocationAutocomplete pick ---------------
  const chipText = useMemo(() => {
    if (!mapResult) return ''
    const rich = formatRichAddress(mapResult).trim()
    if (!rich) return ''
    if (rich === value.trim()) return ''
    return rich
  }, [mapResult, value])

  const applySuggestion = useCallback(
    (text: string) => {
      // Suppress the next debounce-driven fetch so the dropdown doesn't
      // immediately reopen with results for the freshly-applied text.
      skipNextFetchRef.current = true
      onChange(text)
      setSuggestions([])
      setIsFocused(false)
    },
    [onChange],
  )

  return (
    <div ref={containerRef} className="relative">
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        className="input resize-none"
      />

      {/* Quick-fill chip from the map pick — hidden when the textarea
          already matches the suggestion, or when the user is actively
          typing (dropdown takes over). */}
      {chipText && !isFocused && (
        <button
          type="button"
          onClick={() => applySuggestion(chipText)}
          className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-flame-500/25 bg-flame-500/[0.06] p-3 text-left text-xs text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/[0.10]"
        >
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-flame-300" />
          <span className="flex-1 truncate">
            <span className="text-white/55">Use map pick: </span>
            <span className="text-white">{chipText}</span>
          </span>
          <span className="flex-shrink-0 rounded-full bg-flame-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            Apply
          </span>
        </button>
      )}

      {/* Live autocomplete dropdown */}
      {isFocused && (suggestions.length > 0 || isLoading) && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/12 bg-ink-900/95 p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur"
        >
          {isLoading && suggestions.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/55">
              <Search className="h-3.5 w-3.5 animate-pulse" />
              Searching…
            </div>
          )}
          {suggestions.map((s) => {
            const rich = formatRichAddress(s)
            return (
              <button
                key={s.placeId}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(rich)}
                className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {rich}
                  </p>
                  {rich !== s.displayName && (
                    <p className="mt-0.5 truncate text-[11px] text-white/45">
                      {s.displayName}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
