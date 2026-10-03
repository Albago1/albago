'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, MapPin } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import EventsFilterBar, {
  type SearchSuggestion,
  type SortBy,
  type TimeFilter,
} from '@/components/events/EventsFilterBar'
import EventCard, { type PublicEvent } from '@/components/events/EventCard'
import { CATEGORIES, CATEGORY_ICONS, categoryLabel } from '@/components/events/categoryMeta'
import EventRow from '@/components/events/EventRow'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import {
  isThisWeekend,
  isToday,
  getTodayDateString,
  getWeekendDateStrings,
} from '@/lib/dateFilters'
import {
  hasOccurrenceInRange,
  isRecurring,
  nextOccurrence,
} from '@/lib/recurrence'
import { createClient } from '@/lib/supabase/browser'
import { trackInteraction } from '@/lib/track'
import { getLocationBySlug, type LocationOption } from '@/lib/locations'
import { useLocations } from '@/lib/useLocations'
import { fetchSavedEventIds } from '@/lib/savedEvents'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'
import { getEventTimezone, zonedWallClockToUtcMs } from '@/lib/timezone'
import { useRouter, useSearchParams } from 'next/navigation'

function titleizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function resolveLocation(
  slug: string,
  dynamicOptions: LocationOption[],
): LocationOption {
  const fromDynamic = dynamicOptions.find((l) => l.slug === slug)
  if (fromDynamic) return fromDynamic
  // The dynamic list may still be loading — fall back to the hardcoded list,
  // and as a last resort synthesize an option from the slug so we never show
  // the wrong city label.
  const fromStatic = getLocationBySlug(slug)
  if (fromStatic.slug === slug) return fromStatic
  return {
    label: titleizeSlug(slug),
    slug,
    country: '',
    center: [0, 0],
    zoom: 12.5,
  }
}

/** Lowercase + strip diacritics so "Durres" matches "Durrës". */
function normalizePlaceText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

type PlaceMatch =
  | { kind: 'city'; slug: string }
  | { kind: 'country'; country: string }

/**
 * If the search text IS a known city or country name, the user is asking
 * "what's happening there" — return the location so the caller can filter
 * by place instead of full-text matching the words.
 */
function matchKnownPlace(
  query: string,
  locations: LocationOption[],
): PlaceMatch | null {
  const nq = normalizePlaceText(query)
  if (nq.length < 3) return null
  for (const loc of locations) {
    if (loc.slug === 'all') continue
    if (loc.slug === nq || normalizePlaceText(loc.label) === nq) {
      return { kind: 'city', slug: loc.slug }
    }
  }
  for (const loc of locations) {
    if (loc.country && normalizePlaceText(loc.country) === nq) {
      return { kind: 'country', country: loc.country }
    }
  }
  return null
}

function eventInstantMs(e: PublicEvent, date = e.date): number {
  const hhmm = e.time?.slice(0, 5) ?? '00:00'
  const tz = getEventTimezone(e.location_slug, e.country)
  return zonedWallClockToUtcMs(date, hhmm, tz)
}

function sortEventsByPriority(list: PublicEvent[]) {
  return [...list].sort((a, b) => {
    if (Boolean(a.highlight) !== Boolean(b.highlight)) {
      return a.highlight ? -1 : 1
    }
    return eventInstantMs(a) - eventInstantMs(b)
  })
}

type EventsClientProps = {
  /** Server-rendered initial list (null when SSR skipped, e.g. search mode). */
  initialEvents?: PublicEvent[] | null
  initialPlaceNames?: Array<[string, string]> | null
}

export default function EventsClient({
  initialEvents = null,
  initialPlaceNames = null,
}: EventsClientProps) {
  return (
    <Suspense>
      <EventsContent
        initialEvents={initialEvents}
        initialPlaceNames={initialPlaceNames}
      />
    </Suspense>
  )
}

function EventsContent({ initialEvents, initialPlaceNames }: EventsClientProps) {
  const { t } = useLanguage()
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const router = useRouter()
  const locationOptions = useLocations()

  const initialLocationSlug = searchParams.get('location') || 'all'
  const initialSearchQuery = searchParams.get('q') || ''
  const timeParam = searchParams.get('time')
  const initialTimeFilter: TimeFilter =
    timeParam === 'tonight' || timeParam === 'weekend' ? timeParam : 'all'

  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>(initialTimeFilter)
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all')

  const initialSort = (() => {
    const raw = searchParams.get('sort') as SortBy | null
    if (raw === 'date-asc' || raw === 'date-desc' || raw === 'featured') return raw
    return 'featured' as SortBy
  })()
  const [sortBy, setSortBy] = useState<SortBy>(initialSort)
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '')
  const hasDateRange = dateFrom !== '' || dateTo !== ''
  const [activeLocationSlug, setActiveLocationSlug] = useState(initialLocationSlug)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchQuery)
  // Bumped whenever the URL asks to focus the search box (?focus=search —
  // the bottom-nav Search tab). The param is stripped right away so tapping
  // the tab again re-triggers the focus.
  const [searchFocusSignal, setSearchFocusSignal] = useState(0)
  const [events, setEvents] = useState<PublicEvent[]>(initialEvents ?? [])
  const [placeNames, setPlaceNames] = useState<Map<string, string>>(
    () => new Map(initialPlaceNames ?? []),
  )
  const [isLoading, setIsLoading] = useState(initialEvents == null)
  // The server already rendered the list for the initial URL — skip the
  // mount-time client refetch of identical data. Later runs (city change,
  // search, dynamic location list arriving) fetch as before.
  const serverSeededRef = useRef(initialEvents != null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isAuth, setIsAuth] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
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
  }, [supabase])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Analytics: city picks and search demand. City fires on change only (not
  // the landing default); search fires per settled (debounced) query.
  const cityTrackReadyRef = useRef(false)
  useEffect(() => {
    if (!cityTrackReadyRef.current) {
      cityTrackReadyRef.current = true
      return
    }
    if (activeLocationSlug === 'all') return
    trackInteraction('city_search', { city: activeLocationSlug })
  }, [activeLocationSlug])

  useEffect(() => {
    const q = debouncedSearch.trim()
    if (!q) return
    trackInteraction('search_query', { meta: { q: q.slice(0, 120) } })
  }, [debouncedSearch])

  // An empty query hides suggestions at render time (see the filter bar
  // props below) instead of clearing state inside this effect.
  useEffect(() => {
    if (!searchQuery.trim()) return
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, category, location_slug')
        .eq('status', 'published')
        .ilike('title', `%${searchQuery.trim()}%`)
        .limit(5)
      setSuggestions(data ?? [])
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery, supabase])

  const isSearchMode = debouncedSearch.trim().length > 0

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim()
        // Typing a known place name ("Albania", "Tirana", "Berlin") means
        // "events THERE" — filter by location instead of matching the word
        // inside titles/descriptions (which pulled in Rome/Köln events
        // whose text mentions Albania).
        const place = matchKnownPlace(q, locationOptions)
        let query = supabase
          .from('events')
          .select('*')
          .eq('status', 'published')
          .or(activeEventsOrFilter())
        if (place?.kind === 'city') {
          query = query.eq('location_slug', place.slug)
        } else if (place?.kind === 'country') {
          query = query.ilike('country', place.country)
        } else {
          query = query.textSearch('search_vector', q, { type: 'plain', config: 'simple' })
          // Text search respects the picked city instead of going global.
          if (activeLocationSlug !== 'all') {
            query = query.eq('location_slug', activeLocationSlug)
          }
        }
        const { data, error } = await query
          .order('date', { ascending: true })
          .limit(60)

        setIsLoading(false)

        if (error) {
          // Raw DB errors stay in the console; visitors get a human message.
          console.error('[events] search fetch failed:', error.message)
          setErrorMessage("We couldn't load events right now — please try again in a moment.")
          return
        }

        const results = (data ?? []).filter(isEventActive)
        setEvents(results)

        const placeIds = [...new Set(results.flatMap((e) => (e.place_id ? [e.place_id] : [])))]

        if (placeIds.length > 0) {
          const { data: placesData } = await supabase
            .from('places')
            .select('id, name')
            .in('id', placeIds)
          setPlaceNames(new Map((placesData ?? []).map((p) => [p.id, p.name])))
        } else {
          setPlaceNames(new Map())
        }
      } else {
        const isAllCities = activeLocationSlug === 'all'
        const eventsQuery = supabase
          .from('events')
          .select('*')
          .eq('status', 'published')
          .or(activeEventsOrFilter())
          .order('date', { ascending: true })
          .order('time', { ascending: true })
        const placesQuery = supabase.from('places').select('id, name')
        const [eventsRes, placesRes] = await Promise.all([
          isAllCities
            ? eventsQuery
            : eventsQuery.eq('location_slug', activeLocationSlug),
          isAllCities
            ? placesQuery
            : placesQuery.eq('location_slug', activeLocationSlug),
        ])

        setIsLoading(false)

        if (eventsRes.error) {
          console.error('[events] fetch failed:', eventsRes.error.message)
          setErrorMessage("We couldn't load events right now — please try again in a moment.")
          return
        }

        setEvents((eventsRes.data ?? []).filter(isEventActive))

        if (placesRes.data) {
          setPlaceNames(new Map(placesRes.data.map((p) => [p.id, p.name])))
        }
      }
    }

    if (serverSeededRef.current) {
      serverSeededRef.current = false
      return
    }
    fetchEvents()
  }, [supabase, activeLocationSlug, debouncedSearch, locationOptions])

  useEffect(() => {
    if (searchParams.get('focus') !== 'search') return
    // Bump the focus signal from a callback, not the effect body
    // (react-hooks/set-state-in-effect).
    queueMicrotask(() => setSearchFocusSignal((n) => n + 1))
    const params = new URLSearchParams(searchParams.toString())
    params.delete('focus')
    const qs = params.toString()
    router.replace(qs ? `/events?${qs}` : '/events')
  }, [searchParams, router])

  useEffect(() => {
    const params = new URLSearchParams()
    if (activeLocationSlug !== 'all') params.set('location', activeLocationSlug)
    if (activeCategory !== 'all') params.set('category', activeCategory)
    if (activeTimeFilter !== 'all') params.set('time', activeTimeFilter)
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())
    if (sortBy !== 'featured') params.set('sort', sortBy)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    router.replace(`/events?${params.toString()}`)
  }, [
    activeLocationSlug,
    activeCategory,
    activeTimeFilter,
    debouncedSearch,
    sortBy,
    dateFrom,
    dateTo,
    router,
  ])

  const clearAllFilters = () => {
    setActiveLocationSlug('all')
    setActiveCategory('all')
    setActiveTimeFilter('all')
    setSortBy('featured')
    setDateFrom('')
    setDateTo('')
  }

  const filteredEvents = useMemo(() => {
    const weekendDates = getWeekendDateStrings()
    const weekendFrom = weekendDates[0] ?? getTodayDateString()
    const weekendTo = weekendDates[weekendDates.length - 1] ?? weekendFrom
    const today = getTodayDateString()

    return events.filter((event) => {
      // Recurring events expand into any matching day inside the queried
      // window; non-recurring keep the existing exact-date semantics.
      const recurring = isRecurring(event)

      let timeMatches: boolean
      if (hasDateRange) {
        const from = dateFrom || today
        const to = dateTo || '9999-12-31'
        timeMatches = recurring
          ? hasOccurrenceInRange(event, from, to)
          : event.date >= from && event.date <= to
      } else if (activeTimeFilter === 'all') {
        timeMatches = true
      } else if (activeTimeFilter === 'tonight') {
        timeMatches = recurring
          ? hasOccurrenceInRange(event, today, today)
          : isToday(event.date)
      } else if (activeTimeFilter === 'weekend') {
        timeMatches = recurring
          ? hasOccurrenceInRange(event, weekendFrom, weekendTo)
          : isThisWeekend(event.date)
      } else {
        timeMatches = true
      }

      const categoryMatches =
        activeCategory === 'all' ||
        event.category.toLowerCase() === activeCategory.toLowerCase()

      return timeMatches && categoryMatches
    })
  }, [activeTimeFilter, activeCategory, events, hasDateRange, dateFrom, dateTo])

  const sortedEvents = useMemo(() => {
    const today = getTodayDateString()
    const effectiveDate = (e: PublicEvent) =>
      isRecurring(e) ? nextOccurrence(e, today) ?? e.date : e.date
    if (sortBy === 'date-asc') {
      return [...filteredEvents].sort(
        (a, b) => eventInstantMs(a, effectiveDate(a)) - eventInstantMs(b, effectiveDate(b)),
      )
    }
    if (sortBy === 'date-desc') {
      return [...filteredEvents].sort(
        (a, b) => eventInstantMs(b, effectiveDate(b)) - eventInstantMs(a, effectiveDate(a)),
      )
    }
    return sortEventsByPriority(filteredEvents)
  }, [filteredEvents, sortBy])

  // "All" view: one horizontal row per category (Netflix-style), in the
  // filter-rail order, each keeping the chosen sort. Unknown categories collect at the end.
  const eventGroups = useMemo(() => {
    if (activeCategory !== 'all') return null
    const order: string[] = CATEGORIES.filter((c) => c !== 'all')
    const buckets = new Map<string, PublicEvent[]>()
    for (const event of sortedEvents) {
      const key = (event.category ?? '').toLowerCase() || 'other'
      const list = buckets.get(key)
      if (list) list.push(event)
      else buckets.set(key, [event])
    }
    const known = order.filter((c) => buckets.has(c))
    const rest = Array.from(buckets.keys()).filter((c) => !order.includes(c)).sort()
    return [...known, ...rest].map((category) => ({
      category,
      events: buckets.get(category) ?? [],
    }))
  }, [activeCategory, sortedEvents])

  const isAllCities = activeLocationSlug === 'all'
  const activeLocation = resolveLocation(activeLocationSlug, locationOptions)
  const headerCity = isAllCities ? t('filter_worldwide') : activeLocation.label
  const headerCountry = isAllCities ? '' : activeLocation.country


  const renderEventCard = (event: PublicEvent) => (
    <motion.div
      key={event.id}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.6 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="h-full"
    >
      <EventCard
        event={event}
        venueName={
          event.place_id ? placeNames.get(event.place_id) ?? null : null
        }
        cityLabel={resolveLocation(event.location_slug, locationOptions).label}
        isAuthenticated={isAuth}
        initialSaved={savedIds.has(event.id)}
      />
    </motion.div>
  )

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-10 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-flame-500/15 blur-3xl" />
          <div className="absolute right-[18%] top-28 h-[22rem] w-[22rem] rounded-full bg-flame-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('events_back')}
          </Link>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-flame-500/30 bg-flame-500/10 px-4 py-2 text-sm text-flame-300">
            <MapPin className="h-4 w-4" />
            {isSearchMode
              ? t('filter_all_cities')
              : headerCountry
                ? `${headerCity}, ${headerCountry}`
                : headerCity}
          </div>

          <h1 className="display-text mt-6 text-5xl sm:text-7xl lg:text-[88px] leading-[0.95] tracking-tight">
            {isSearchMode
              ? `${t('events_results_for')} "${debouncedSearch}"`
              : isAllCities
                ? t('events_all_events')
                : `${t('events_all_events_in')} ${headerCity}`}
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            {t('events_hero_sub')}
          </p>
        </div>
      </section>

      <EventsFilterBar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={() => setDebouncedSearch(searchQuery)}
        suggestions={searchQuery.trim() ? suggestions : []}
        onPickSuggestion={(s) => setSearchQuery(s.title)}
        isSearchMode={isSearchMode}
        searchFocusSignal={searchFocusSignal}
        locationOptions={locationOptions}
        activeLocationSlug={activeLocationSlug}
        onLocationChange={setActiveLocationSlug}
        timeFilter={activeTimeFilter}
        onTimeFilterChange={setActiveTimeFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateRangeChange={(from, to) => {
          setDateFrom(from)
          setDateTo(to)
        }}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        mapHref={`/map?location=${activeLocationSlug}`}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultCount={sortedEvents.length}
        isLoading={isLoading}
        onClearAll={clearAllFilters}
      />

      <section className="px-4 pb-20 pt-6">
        <div className="mx-auto max-w-6xl">
          {isLoading && !errorMessage && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="aspect-[16/10] w-full bg-white/[0.06]" />
                  <div className="p-4">
                    <div className="h-5 w-3/4 rounded-lg bg-white/[0.08]" />
                    <div className="mt-2 h-5 w-1/2 rounded-lg bg-white/[0.08]" />
                    <div className="mt-3 h-4 w-2/3 rounded bg-white/[0.05]" />
                    <div className="mt-5 h-4 w-1/3 rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center">
              <p className="text-base font-semibold text-red-200">
                {t('events_error_title')}
              </p>
              <p className="mt-1 text-sm text-red-200/70">
                {t('events_error_hint')}
              </p>
            </div>
          )}

          {!isLoading && !errorMessage && sortedEvents.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center backdrop-blur-md">
              {isSearchMode ? (
                <>
                  <p className="text-base font-semibold text-white">
                    {t('events_empty_search_title')} &ldquo;{debouncedSearch}&rdquo;
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    {t('events_empty_search_hint')}
                  </p>
                </>
              ) : !locationOptions.some((l) => l.slug === activeLocationSlug) ? (
                <>
                  <p className="text-base font-semibold text-white">
                    {t('events_empty_near_title')}
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    {t('events_empty_near_hint')}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {locationOptions.slice(0, 4).map((loc) => (
                      <button
                        key={loc.slug}
                        type="button"
                        onClick={() => setActiveLocationSlug(loc.slug)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-white">
                    {t('events_empty_filter_title')}
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    {t('events_empty_filter_hint')}
                  </p>
                </>
              )}
            </div>
          )}

          {!isLoading && !errorMessage && eventGroups && (
            <div className="space-y-12">
              {eventGroups.map(({ category, events: groupEvents }) => {
                const Icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.all
                return (
                  <section key={category} aria-labelledby={`events-group-${category}`}>
                    <EventRow
                      labelledBy={`events-group-${category}`}
                      heading={
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                            <Icon className="h-5 w-5 text-flame-300" />
                          </span>
                          <h2
                            id={`events-group-${category}`}
                            className="display-text truncate text-2xl text-white sm:text-3xl"
                          >
                            {categoryLabel(category, t)}
                          </h2>
                        </div>
                      }
                    >
                      {groupEvents.map((event) => (
                        <div
                          key={event.id}
                          role="listitem"
                          className="w-[82%] shrink-0 snap-start sm:w-[300px] lg:w-[340px]"
                        >
                          {renderEventCard(event)}
                        </div>
                      ))}
                    </EventRow>
                  </section>
                )
              })}
            </div>
          )}

          {!isLoading && !errorMessage && !eventGroups && (
            <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {sortedEvents.map((event) => renderEventCard(event))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>
    </main>
  )
}
