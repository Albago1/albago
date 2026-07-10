'use client'

// The /map search experience, modeled on the best-in-class pattern shared by
// Google Maps, Airbnb, and Booking: one search box that understands cities
// (anywhere on earth, via geocoding fallback), events, venues, and
// categories; ranked results with the typed match highlighted; recent
// searches when the box is empty; and an explicit "search" commit — the map
// never live-filters on half-typed text.
//
// Pure search logic (ranking, folding, recents, geocoding) lives in
// lib/mapSearch.ts. This file is the UI: a shared `useMapSearch` hook +
// `MapSearchResults` list used by both the mobile full-screen overlay
// (exported here) and the desktop dropdown (in FilterBar).

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Clock3,
  Globe,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Tag,
  X,
} from 'lucide-react'
import { CATEGORY_ICONS, categoryLabel } from '@/components/events/categoryMeta'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import {
  clearRecentSearches,
  highlightSegments,
  matchScore,
  pushRecentSearch,
  readRecentSearches,
  searchRemoteCities,
  tokenizeQuery,
  type MapSearchCity,
  type MapSearchEventRow,
  type MapSearchIndex,
  type MapSearchPlaceRow,
  type RecentSearch,
  type RemoteCity,
} from '@/lib/mapSearch'

const SEARCHABLE_CATEGORIES = ['nightlife', 'music', 'sports', 'culture', 'food', 'civic']

export type MapSearchActions = {
  onPickCity: (slug: string, center?: [number, number]) => void
  onPickEvent: (id: string, center: [number, number]) => void
  onPickPlace: (id: string, center: [number, number]) => void
  onPickCategory: (category: string) => void
  onCommitQuery: (query: string) => void
  onUseMyLocation: () => void
}

export type SearchRow =
  | { type: 'use-location' }
  | { type: 'recent'; recent: RecentSearch }
  | { type: 'city'; city: MapSearchCity }
  | { type: 'remote-city'; city: RemoteCity }
  | { type: 'category'; category: string }
  | { type: 'event'; event: MapSearchEventRow }
  | { type: 'place'; place: MapSearchPlaceRow }
  | { type: 'query'; query: string }

function rowKey(row: SearchRow): string {
  switch (row.type) {
    case 'use-location':
      return 'use-location'
    case 'recent':
      return `recent-${row.recent.kind}-${row.recent.label}`
    case 'city':
      return `city-${row.city.slug}`
    case 'remote-city':
      return `remote-${row.city.slug}-${row.city.center.join(',')}`
    case 'category':
      return `category-${row.category}`
    case 'event':
      return `event-${row.event.id}`
    case 'place':
      return `place-${row.place.id}`
    case 'query':
      return 'query'
  }
}

// Executes a picked row against the map callbacks. Returns the entry to
// remember in recent searches (null = don't remember, e.g. use-my-location).
export function runSearchRow(
  row: SearchRow,
  actions: MapSearchActions,
): RecentSearch | null {
  switch (row.type) {
    case 'use-location':
      actions.onUseMyLocation()
      return null
    case 'recent': {
      const r = row.recent
      if (r.kind === 'city') actions.onPickCity(r.slug, r.center)
      else if (r.kind === 'event') actions.onPickEvent(r.id, r.center)
      else if (r.kind === 'place') actions.onPickPlace(r.id, r.center)
      else actions.onCommitQuery(r.label)
      return r
    }
    case 'city':
      actions.onPickCity(row.city.slug, row.city.center)
      return {
        kind: 'city',
        slug: row.city.slug,
        label: row.city.label,
        sub: row.city.country,
        center: row.city.center,
      }
    case 'remote-city':
      actions.onPickCity(row.city.slug, row.city.center)
      return {
        kind: 'city',
        slug: row.city.slug,
        label: row.city.label,
        sub: row.city.country || row.city.displayName,
        center: row.city.center,
      }
    case 'category':
      actions.onPickCategory(row.category)
      return null
    case 'event':
      actions.onPickEvent(row.event.id, row.event.center)
      return {
        kind: 'event',
        id: row.event.id,
        label: row.event.title,
        sub: row.event.sub,
        category: row.event.category,
        center: row.event.center,
      }
    case 'place':
      actions.onPickPlace(row.place.id, row.place.center)
      return {
        kind: 'place',
        id: row.place.id,
        label: row.place.name,
        sub: row.place.sub,
        center: row.place.center,
      }
    case 'query': {
      const q = row.query.trim()
      if (!q) return null
      actions.onCommitQuery(q)
      return { kind: 'query', label: q }
    }
  }
}

export function useMapSearch(query: string, index: MapSearchIndex) {
  const { t } = useLanguage()
  const tokens = useMemo(() => tokenizeQuery(query), [query])

  // Recents load client-side only (localStorage).
  const [recents, setRecents] = useState<RecentSearch[]>([])
  useEffect(() => {
    setRecents(readRecentSearches())
  }, [])
  const refreshRecents = () => setRecents(readRecentSearches())
  const clearRecents = () => {
    clearRecentSearches()
    setRecents([])
  }

  const local = useMemo(() => {
    if (tokens.length === 0) {
      return {
        cities: [] as MapSearchCity[],
        categories: [] as string[],
        events: [] as MapSearchEventRow[],
        places: [] as MapSearchPlaceRow[],
      }
    }
    const cities = index.cities
      .map((city) => ({ city, score: matchScore(tokens, city.label, city.country) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.city)
    const categories = SEARCHABLE_CATEGORIES.map((category) => ({
      category,
      score: matchScore(tokens, categoryLabel(category, t)),
    }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((x) => x.category)
    const events = index.events
      .map((event) => ({
        event,
        score: matchScore(tokens, event.title, `${event.sub} ${event.category}`),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.event)
    const places = index.places
      .map((place) => ({ place, score: matchScore(tokens, place.name, place.sub) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.place)
    return { cities, categories, events, places }
  }, [tokens, index, t])

  // Geocoding fallback: when the local city list has no strong match,
  // resolve worldwide cities (debounced, aborted on every keystroke).
  const [remoteCities, setRemoteCities] = useState<RemoteCity[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const localCityCount = local.cities.length
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 || localCityCount >= 2) {
      setRemoteCities([])
      setRemoteLoading(false)
      return
    }
    let cancelled = false
    setRemoteLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const hits = await searchRemoteCities(q, ctrl.signal)
        if (cancelled) return
        const localSlugs = new Set(index.cities.map((c) => c.slug))
        setRemoteCities(hits.filter((h) => !localSlugs.has(h.slug)).slice(0, 3))
      } catch {
        if (!cancelled) setRemoteCities([])
      } finally {
        if (!cancelled) setRemoteLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [query, localCityCount, index.cities])

  const rows = useMemo<SearchRow[]>(() => {
    if (tokens.length === 0) {
      return [
        { type: 'use-location' },
        ...recents.map((recent): SearchRow => ({ type: 'recent', recent })),
      ]
    }
    const out: SearchRow[] = []
    for (const city of local.cities) out.push({ type: 'city', city })
    for (const city of remoteCities) out.push({ type: 'remote-city', city })
    for (const category of local.categories) out.push({ type: 'category', category })
    for (const event of local.events) out.push({ type: 'event', event })
    for (const place of local.places) out.push({ type: 'place', place })
    out.push({ type: 'query', query: query.trim() })
    return out
  }, [tokens, recents, local, remoteCities, query])

  return { tokens, rows, recents, refreshRecents, clearRecents, remoteLoading }
}

function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>
  return (
    <>
      {highlightSegments(text, tokens).map((seg, i) =>
        seg.hit ? (
          <span key={i} className="font-semibold text-white">
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}

function rowIcon(row: SearchRow) {
  switch (row.type) {
    case 'use-location':
      return <LocateFixed className="h-4 w-4" />
    case 'recent':
      return <Clock3 className="h-4 w-4" />
    case 'city':
      return <MapPin className="h-4 w-4" />
    case 'remote-city':
      return <Globe className="h-4 w-4" />
    case 'category': {
      const Icon = CATEGORY_ICONS[row.category] ?? Tag
      return <Icon className="h-4 w-4" />
    }
    case 'event': {
      const Icon = CATEGORY_ICONS[row.event.category] ?? Tag
      return <Icon className="h-4 w-4" />
    }
    case 'place':
      return <MapPin className="h-4 w-4" />
    case 'query':
      return <Search className="h-4 w-4" />
  }
}

type MapSearchResultsProps = {
  tokens: string[]
  rows: SearchRow[]
  recents: RecentSearch[]
  remoteLoading: boolean
  activeIndex: number
  popularCities: MapSearchCity[]
  onRun: (row: SearchRow) => void
  onClearRecents: () => void
}

// The shared result list. Rows are flat (for keyboard navigation); section
// headers are derived from where each result type starts.
export function MapSearchResults({
  tokens,
  rows,
  recents,
  remoteLoading,
  activeIndex,
  popularCities,
  onRun,
  onClearRecents,
}: MapSearchResultsProps) {
  const { t } = useLanguage()
  const isEmpty = tokens.length === 0

  // Section header for each row index: shown where a new result type starts.
  const rowHeaders = useMemo(() => {
    const sectionFor = (row: SearchRow): string | null => {
      if (row.type === 'city' || row.type === 'remote-city') return t('map_search_cities')
      if (row.type === 'event') return t('map_search_events')
      if (row.type === 'place') return t('map_search_venues')
      if (row.type === 'recent') return t('map_search_recent')
      return null
    }
    return rows.map((row, i) => {
      const section = sectionFor(row)
      if (!section) return null
      // Header only where the section differs from the previous sectioned row.
      for (let j = i - 1; j >= 0; j--) {
        const prev = sectionFor(rows[j])
        if (prev) return prev === section ? null : section
      }
      return section
    })
  }, [rows, t])

  const subFor = (row: SearchRow): string | null => {
    switch (row.type) {
      case 'use-location':
        return null
      case 'recent':
        return row.recent.kind === 'query' ? null : (row.recent.sub || null)
      case 'city':
        return row.city.country || null
      case 'remote-city':
        return row.city.displayName
      case 'category':
        return t('filter_category')
      case 'event':
        return row.event.sub
      case 'place':
        return row.place.sub
      case 'query':
        return null
    }
  }

  const labelFor = (row: SearchRow): React.ReactNode => {
    switch (row.type) {
      case 'use-location':
        return t('home_use_my_location')
      case 'recent':
        return row.recent.label
      case 'city':
        return <Highlighted text={row.city.label} tokens={tokens} />
      case 'remote-city':
        return <Highlighted text={row.city.label} tokens={tokens} />
      case 'category':
        return <Highlighted text={categoryLabel(row.category, t)} tokens={tokens} />
      case 'event':
        return <Highlighted text={row.event.title} tokens={tokens} />
      case 'place':
        return <Highlighted text={row.place.name} tokens={tokens} />
      case 'query':
        return `${t('map_search_for')} “${row.query}”`
    }
  }

  // "No matches" shows only once the geocoder has also come back empty.
  const noMatches =
    !isEmpty &&
    !remoteLoading &&
    rows.length === 1 &&
    rows[0].type === 'query'

  return (
    <div className="py-2">
      {rows.map((row, i) => {
        const headerLabel = rowHeaders[i]
        const header = headerLabel ? (
          <div className="flex items-center justify-between px-5 pb-1 pt-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              {headerLabel}
            </span>
            {row.type === 'recent' && recents.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClearRecents}
                className="text-xs font-medium text-white/45 transition hover:text-white"
              >
                {t('filter_clear_all')}
              </button>
            )}
          </div>
        ) : null
        const sub = subFor(row)
        const isFlame = row.type === 'event' || row.type === 'use-location'

        return (
          <div key={rowKey(row)}>
            {header}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRun(row)}
              className={[
                'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                i === activeIndex ? 'bg-white/[0.07]' : 'active:bg-white/[0.06] hover:bg-white/[0.05]',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]',
                  isFlame ? 'text-flame-300' : 'text-white/70',
                ].join(' ')}
              >
                {rowIcon(row)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-white/90">
                  {labelFor(row)}
                </span>
                {sub && (
                  <span className="block truncate text-xs text-white/45">{sub}</span>
                )}
              </span>
            </button>
          </div>
        )
      })}

      {remoteLoading && !isEmpty && (
        <div className="flex items-center gap-2 px-5 py-3 text-xs text-white/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('filter_loading')}…
        </div>
      )}

      {noMatches && (
        <p className="px-5 py-3 text-sm text-white/50">{t('map_search_no_matches')}</p>
      )}

      {isEmpty && popularCities.length > 0 && (
        <div className="px-5 pt-4">
          <p className="pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            {t('map_search_popular')}
          </p>
          <div className="flex flex-wrap gap-1.5 pb-2">
            {popularCities.slice(0, 8).map((city) => (
              <button
                key={city.slug}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRun({ type: 'city', city })}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              >
                {city.label}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

type MapSearchOverlayProps = {
  open: boolean
  initialQuery: string
  index: MapSearchIndex
  popularCities: MapSearchCity[]
  actions: MapSearchActions
  onClose: () => void
}

// Mobile full-screen search view — the Google Maps app pattern: tapping the
// search pill opens this, the map waits underneath, and everything (recents,
// suggestions, worldwide cities, commit) happens here.
export function MapSearchOverlay({
  open,
  initialQuery,
  index,
  popularCities,
  actions,
  onClose,
}: MapSearchOverlayProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { tokens, rows, recents, refreshRecents, clearRecents, remoteLoading } =
    useMapSearch(query, index)

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery)
    setActiveIndex(-1)
    refreshRecents()
    // Focus after paint so the keyboard opens reliably on iOS.
    const timer = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    setActiveIndex(-1)
  }, [query])

  if (!open) return null

  const run = (row: SearchRow) => {
    const recent = runSearchRow(row, actions)
    if (recent) pushRecentSearch(recent)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[activeIndex] ?? ({ type: 'query', query } as SearchRow)
      run(row)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink-950">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label={t('map_reset')}
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition active:bg-white/[0.06]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          enterKeyHint="search"
          placeholder={t('map_search_placeholder')}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/40"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition active:bg-white/[0.06]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <MapSearchResults
          tokens={tokens}
          rows={rows}
          recents={recents}
          remoteLoading={remoteLoading}
          activeIndex={activeIndex}
          popularCities={popularCities}
          onRun={run}
          onClearRecents={clearRecents}
        />
      </div>
    </div>
  )
}
