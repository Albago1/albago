'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CircleUserRound,
  Flame,
  Home,
  MapPin,
  Search,
  SlidersHorizontal,
  Tag,
  X,
  CalendarDays,
  Moon,
  RotateCcw,
} from 'lucide-react'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import CitySearchInput, { type ResolvedCity } from '@/components/location/CitySearchInput'
import { CATEGORY_ICONS, categoryLabel } from '@/components/events/categoryMeta'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/browser'

type TimeFilter = 'all' | 'tonight' | 'weekend' | 'week'

type LocationOption = {
  slug: string
  label: string
  country: string
  center?: [number, number]
}

type CountryCount = { country: string; count: number }

export type MapSearchSuggestions = {
  events: { id: string; title: string; sub: string; category: string }[]
  places: { id: string; name: string; sub: string }[]
  cities: { slug: string; label: string; country: string; center?: [number, number] }[]
}

type FilterBarProps = {
  activeTimeFilter: TimeFilter
  activeCategory: string
  searchQuery: string
  optionFilter: string
  activeLocationSlug: string
  activeLocationLabel?: string
  locationOptions: LocationOption[]
  visiblePlacesCount: number
  visibleEventsCount: number
  availableOptionChips: string[]
  countryOptions?: CountryCount[]
  activeCountry?: string | null
  onCountryChange?: (country: string | null) => void
  isMobile: boolean
  suggestions?: MapSearchSuggestions
  onPickEventSuggestion?: (id: string) => void
  onPickPlaceSuggestion?: (id: string) => void
  onTimeFilterChange: (value: TimeFilter) => void
  onCategoryChange: (value: string) => void
  onSearchQueryChange: (value: string) => void
  onOptionFilterChange: (value: string) => void
  onLocationChange: (slug: string, center?: [number, number]) => void
  onReset: () => void
}

const categories = ['all', 'nightlife', 'music', 'sports', 'culture', 'food', 'civic']
const timeFilters: TimeFilter[] = ['tonight', 'weekend', 'week', 'all']

function getTimeFilterLabel(filter: TimeFilter, t: (key: string) => string) {
  if (filter === 'all') return t('filter_all')
  if (filter === 'tonight') return t('tonight')
  if (filter === 'week') return t('map_this_week')
  return t('filter_this_weekend')
}

function FilterSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
      {children}
    </h3>
  )
}

function toPopularCities(options: LocationOption[]) {
  return options
    .filter((o) => o.center)
    .map((o) => ({
      slug: o.slug,
      label: o.label,
      country: o.country,
      lng: o.center![0],
      lat: o.center![1],
    }))
}

function DesktopFilterBar(props: FilterBarProps) {
  const {
    activeTimeFilter,
    activeCategory,
    searchQuery,
    optionFilter,
    activeLocationSlug,
    activeLocationLabel,
    locationOptions,
    visiblePlacesCount,
    visibleEventsCount,
    availableOptionChips,
    countryOptions,
    activeCountry,
    onCountryChange,
    onTimeFilterChange,
    onCategoryChange,
    onSearchQueryChange,
    onOptionFilterChange,
    onLocationChange,
    onReset,
  } = props
  const { t } = useLanguage()
  const isWorldwide = activeLocationSlug === 'all'
  const showCountryRow =
    isWorldwide && !!onCountryChange && (countryOptions?.length ?? 0) > 0

  const [locationOpen, setLocationOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [resolvedCity, setResolvedCity] = useState<ResolvedCity | null>(null)
  const popularCities = useMemo(() => toPopularCities(locationOptions), [locationOptions])
  const activeOption = locationOptions.find((o) => o.slug === activeLocationSlug)
  const buttonLabel = activeLocationLabel || activeOption?.label || activeLocationSlug

  const handleResolve = (resolved: ResolvedCity | null) => {
    setResolvedCity(resolved)
    if (resolved) {
      onLocationChange(resolved.slug, [resolved.lng, resolved.lat])
      setLocationOpen(false)
    }
  }

  const hasActiveFilters =
    activeTimeFilter !== 'all' ||
    activeCategory !== 'all' ||
    optionFilter !== 'all' ||
    searchQuery.trim() !== ''

  const hasTags = availableOptionChips.length > 0
  const tagsActive = optionFilter !== 'all'
  const [showTags, setShowTags] = useState(tagsActive)

  return (
    <div className="absolute left-4 top-4 z-20 w-[600px] max-w-[calc(100%-2rem)]">
      <div className="rounded-2xl border border-white/10 bg-ink-950/85 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              aria-label="Home"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Home className="h-4 w-4" />
            </Link>

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder={t('map_search_placeholder')}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-9 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-white/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => onSearchQueryChange('')}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/65 transition hover:bg-white/[0.12] hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setLocationOpen((v) => !v)}
                aria-expanded={locationOpen}
                className="inline-flex h-9 max-w-[180px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-sm text-white/85 outline-none transition hover:bg-white/[0.08]"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-white/50" />
                <span className="truncate">{buttonLabel}</span>
              </button>

              {locationOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setLocationOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-40 mt-2 w-[320px] rounded-2xl border border-white/10 bg-ink-950/95 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                      {t('map_change_location')}
                    </p>
                    <CitySearchInput
                      value={cityQuery}
                      onChange={setCityQuery}
                      onResolve={handleResolve}
                      resolved={resolvedCity}
                      popular={popularCities}
                      onPopularClick={(c) => {
                        onLocationChange(c.slug, [c.lng, c.lat])
                        setLocationOpen(false)
                      }}
                      placeholder={t('protests_search_placeholder')}
                    />
                  </div>
                </>
              )}
            </div>

            <LanguageSwitcher />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {timeFilters.map((filter) => {
              const isActive = activeTimeFilter === filter
              const Icon =
                filter === 'tonight'
                  ? Moon
                  : filter === 'weekend'
                    ? CalendarDays
                    : RotateCcw

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => onTimeFilterChange(filter)}
                  className={[
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    isActive
                      ? 'border-white/15 bg-white text-black'
                      : 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white',
                  ].join(' ')}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {getTimeFilterLabel(filter, t)}
                </button>
              )
            })}

            <span className="shrink-0 self-center px-1 text-white/15">·</span>

            {categories
              .filter((category) => category !== 'all')
              .map((category) => {
                const isActive = activeCategory === category
                const isCivic = category === 'civic'
                const Icon = CATEGORY_ICONS[category] ?? Tag

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onCategoryChange(isActive ? 'all' : category)}
                    className={[
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition',
                      isActive
                        ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
                        : isCivic
                          ? 'border-flame-500/30 bg-flame-500/[0.06] text-flame-200/85 hover:bg-flame-500/10 hover:text-flame-100'
                          : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white',
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {categoryLabel(category, t)}
                  </button>
                )
              })}

            {hasTags && (
              <button
                type="button"
                onClick={() => setShowTags((value) => !value)}
                aria-expanded={showTags}
                className={[
                  'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  showTags || tagsActive
                    ? 'border-white/15 bg-white/[0.08] text-white'
                    : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white',
                ].join(' ')}
              >
                <Tag className="h-3.5 w-3.5" />
                {t('map_tags')}
              </button>
            )}
          </div>

          {hasTags && showTags && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => onOptionFilterChange('all')}
                className={[
                  'shrink-0 rounded-full border px-2.5 py-1 text-xs transition',
                  optionFilter === 'all'
                    ? 'border-white/15 bg-white/10 text-white'
                    : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white',
                ].join(' ')}
              >
                {t('map_all_tags')}
              </button>

              {availableOptionChips.map((option) => {
                const isActive = optionFilter === option

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      onOptionFilterChange(isActive ? 'all' : option)
                    }
                    className={[
                      'shrink-0 rounded-full border px-2.5 py-1 text-xs transition',
                      isActive
                        ? 'border-white/15 bg-white text-black'
                        : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          )}

          {showCountryRow && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => onCountryChange?.(null)}
                className={[
                  'shrink-0 rounded-full border px-2.5 py-1 text-xs transition',
                  !activeCountry
                    ? 'border-white/15 bg-white/10 text-white'
                    : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white',
                ].join(' ')}
              >
                {t('map_all_countries')}
              </button>
              {countryOptions?.slice(0, 18).map((entry) => {
                const isActive = activeCountry === entry.country
                return (
                  <button
                    key={entry.country}
                    type="button"
                    onClick={() =>
                      onCountryChange?.(isActive ? null : entry.country)
                    }
                    className={[
                      'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
                      isActive
                        ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
                        : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white',
                    ].join(' ')}
                  >
                    <span>{entry.country}</span>
                    <span className="rounded-full bg-white/10 px-1.5 py-0 text-[10px] text-white/65">
                      {entry.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 px-1 pt-0.5 text-xs text-white/55">
            <div>
              <span className="font-semibold text-white/85">{visiblePlacesCount}</span>{' '}
              {visiblePlacesCount === 1 ? t('map_place') : t('map_places')}
              <span className="mx-1.5 text-white/20">·</span>
              <span className="font-semibold text-white/85">{visibleEventsCount}</span>{' '}
              {visibleEventsCount === 1 ? t('map_event') : t('map_events')}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs font-medium text-white/55 transition hover:text-white"
              >
                {t('map_reset')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileFilterBar(props: FilterBarProps) {
  const {
    activeTimeFilter,
    activeCategory,
    searchQuery,
    optionFilter,
    activeLocationSlug,
    activeLocationLabel,
    locationOptions,
    visiblePlacesCount,
    visibleEventsCount,
    availableOptionChips,
    suggestions,
    onPickEventSuggestion,
    onPickPlaceSuggestion,
    onTimeFilterChange,
    onCategoryChange,
    onSearchQueryChange,
    onOptionFilterChange,
    onLocationChange,
    onReset,
  } = props
  const { t } = useLanguage()
  const totalResults = visiblePlacesCount + visibleEventsCount
  const resultsLabel =
    totalResults === 0
      ? t('map_no_results')
      : `${totalResults} ${totalResults === 1 ? t('map_result') : t('map_results')}`

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [resolvedCity, setResolvedCity] = useState<ResolvedCity | null>(null)
  const popularCities = useMemo(() => toPopularCities(locationOptions), [locationOptions])

  // Google-Maps-style pill ends in the account avatar. Auth state mirrors
  // MobileBottomNav's pattern.
  const [userEmail, setUserEmail] = useState<string | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleResolve = (resolved: ResolvedCity | null) => {
    setResolvedCity(resolved)
    if (resolved) {
      onLocationChange(resolved.slug, [resolved.lng, resolved.lat])
    }
  }

  const activeFilterCount =
    (activeTimeFilter !== 'all' ? 1 : 0) +
    (activeCategory !== 'all' ? 1 : 0) +
    (optionFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0)

  // Google-Maps-style live suggestions under the pill while typing. Blur is
  // delayed a beat so a tap on a suggestion row lands before the panel hides.
  const [searchFocused, setSearchFocused] = useState(false)
  const hasSuggestions =
    !!suggestions &&
    (suggestions.events.length > 0 ||
      suggestions.places.length > 0 ||
      suggestions.cities.length > 0)
  const showSuggestions = searchFocused && searchQuery.trim().length > 0 && hasSuggestions

  const handleClose = () => setIsSheetOpen(false)

  const handleResetAndClose = () => {
    onReset()
    setIsSheetOpen(false)
  }

  return (
    <>
      <div className="absolute left-3 right-3 top-3 z-20 md:hidden">
        {/* Google-Maps-app search pill: magnifier → input → account avatar,
            one floating rounded-full surface with the chips loose below it
            (no containing card). */}
        <div className="flex h-[52px] items-center gap-2.5 rounded-full border border-white/10 bg-ink-950/90 pl-4 pr-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <Search className="h-5 w-5 shrink-0 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
            placeholder={t('map_search_placeholder')}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchQueryChange('')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/65 transition hover:bg-white/[0.12] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Link
            href={userEmail ? '/dashboard' : '/sign-in?next=/map'}
            aria-label={userEmail ? t('nav_dashboard') : t('sign_in')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          >
            {userEmail ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-flame-500 text-sm font-bold text-[#fff] ring-1 ring-white/20">
                {userEmail[0].toUpperCase()}
              </span>
            ) : (
              <CircleUserRound className="h-6 w-6 text-white/60" strokeWidth={1.9} />
            )}
          </Link>
        </div>

        {showSuggestions && (
          <div className="mt-2 overflow-hidden rounded-3xl border border-white/10 bg-ink-950/95 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            {suggestions!.cities.map((city) => (
              <button
                key={`city-${city.slug}`}
                type="button"
                onClick={() => {
                  if (city.center) onLocationChange(city.slug, city.center)
                  else onLocationChange(city.slug)
                  onSearchQueryChange('')
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{city.label}</span>
                  <span className="block truncate text-xs text-white/45">{city.country}</span>
                </span>
              </button>
            ))}

            {suggestions!.events.map((event) => {
              const Icon = CATEGORY_ICONS[event.category] ?? Tag
              return (
                <button
                  key={`event-${event.id}`}
                  type="button"
                  onClick={() => {
                    onPickEventSuggestion?.(event.id)
                    onSearchQueryChange('')
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-white/[0.06]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-flame-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{event.title}</span>
                    <span className="block truncate text-xs text-white/45">{event.sub}</span>
                  </span>
                </button>
              )
            })}

            {suggestions!.places.map((place) => (
              <button
                key={`place-${place.id}`}
                type="button"
                onClick={() => {
                  onPickPlaceSuggestion?.(place.id)
                  onSearchQueryChange('')
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{place.name}</span>
                  <span className="block truncate text-xs text-white/45">{place.sub}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* One-tap filter rail (Google Maps / Airbnb pattern): time and
            category toggle instantly on the map, no sheet required.
            Tapping an active chip clears it. The CITY leads the rail —
            the first thing anyone wants to know on a map is where they
            are browsing; tapping it opens the picker. Chips float straight
            over the map, so inactive ones carry their own dark glass. */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white px-3.5 py-2 text-xs font-semibold text-black shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
          >
            <MapPin className="h-3.5 w-3.5" />
            {activeLocationLabel ||
              locationOptions.find((o) => o.slug === activeLocationSlug)?.label ||
              activeLocationSlug}
          </button>

          <button
            type="button"
            aria-label={t('map_filters')}
            onClick={() => setIsSheetOpen(true)}
            className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-ink-950/85 px-3.5 py-2 text-xs font-medium text-white/85 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-white px-1.5 py-0 text-[10px] font-semibold text-black">
                {activeFilterCount}
              </span>
            )}
          </button>

          {timeFilters
            .filter((filter) => filter !== 'all')
            .map((filter) => {
              const isActive = activeTimeFilter === filter
              const Icon =
                filter === 'tonight'
                  ? Moon
                  : filter === 'weekend'
                    ? CalendarDays
                    : RotateCcw

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => onTimeFilterChange(isActive ? 'all' : filter)}
                  className={[
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition',
                    isActive
                      ? 'border-white/15 bg-white text-black'
                      : 'border-white/10 bg-ink-950/85 text-white/80 backdrop-blur-xl',
                  ].join(' ')}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {getTimeFilterLabel(filter, t)}
                </button>
              )
            })}

          {categories
            .filter((category) => category !== 'all')
            .map((category) => {
              const isActive = activeCategory === category
              const isCivic = category === 'civic'
              const Icon = CATEGORY_ICONS[category] ?? Tag

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onCategoryChange(isActive ? 'all' : category)}
                  className={[
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium capitalize shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition',
                    isActive
                      ? 'border-flame-500/40 bg-flame-500/15 text-flame-100 backdrop-blur-xl'
                      : isCivic
                        ? 'border-flame-500/30 bg-ink-950/85 text-flame-200/85 backdrop-blur-xl'
                        : 'border-white/10 bg-ink-950/85 text-white/70 backdrop-blur-xl',
                  ].join(' ')}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {categoryLabel(category, t)}
                </button>
              )
            })}

          <div className="shrink-0 rounded-full border border-flame-500/30 bg-ink-950/85 px-3.5 py-2 text-xs font-semibold text-flame-300 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {resultsLabel}
          </div>
        </div>
      </div>

      {isSheetOpen && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/45 md:hidden"
            onClick={handleClose}
          />

          <div className="absolute inset-x-0 bottom-0 z-40 md:hidden">
            <div className="rounded-t-[32px] border-t border-white/10 bg-ink-950 px-4 pb-6 pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.45)]">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />

              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t('map_filters')}</h2>
                  <p className="text-sm text-white/45">
                    {t('map_filters_sub')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <FilterSectionTitle>{t('map_location')}</FilterSectionTitle>

                  <CitySearchInput
                    value={cityQuery}
                    onChange={setCityQuery}
                    onResolve={handleResolve}
                    resolved={resolvedCity}
                    popular={popularCities}
                    onPopularClick={(c) => onLocationChange(c.slug, [c.lng, c.lat])}
                    placeholder={t('protests_search_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <FilterSectionTitle>{t('map_search')}</FilterSectionTitle>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) =>
                        onSearchQueryChange(event.target.value)
                      }
                      placeholder={t('map_search_placeholder')}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-11 text-sm text-white outline-none placeholder:text-white/35"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => onSearchQueryChange('')}
                        className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/65 transition hover:bg-white/[0.12] hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <FilterSectionTitle>{t('map_time')}</FilterSectionTitle>

                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {timeFilters.map((filter) => {
                      const isActive = activeTimeFilter === filter
                      const Icon =
                        filter === 'tonight'
                          ? Moon
                          : filter === 'weekend'
                            ? CalendarDays
                            : RotateCcw

                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => onTimeFilterChange(filter)}
                          className={[
                            'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition',
                            isActive
                              ? 'border-white/15 bg-white text-black'
                              : 'border-white/10 bg-white/[0.04] text-white/80',
                          ].join(' ')}
                        >
                          <Icon className="h-4 w-4" />
                          {getTimeFilterLabel(filter, t)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <FilterSectionTitle>{t('map_category')}</FilterSectionTitle>

                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {categories.map((category) => {
                      const isActive = activeCategory === category
                      const isCivic = category === 'civic'

                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => onCategoryChange(category)}
                          className={[
                            'inline-flex shrink-0 items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-sm font-medium capitalize transition',
                            isActive
                              ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
                              : isCivic
                                ? 'border-flame-500/30 bg-flame-500/[0.06] text-flame-200/85'
                                : 'border-white/10 bg-white/[0.04] text-white/70',
                          ].join(' ')}
                        >
                          {isCivic && <Flame className="h-3.5 w-3.5" />}
                          {categoryLabel(category, t)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {availableOptionChips.length > 0 && (
                  <div className="space-y-2">
                    <FilterSectionTitle>{t('map_tags')}</FilterSectionTitle>

                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <button
                        type="button"
                        onClick={() => onOptionFilterChange('all')}
                        className={[
                          'shrink-0 rounded-full border px-3 py-1.5 text-sm transition',
                          optionFilter === 'all'
                            ? 'border-white/15 bg-white/10 text-white'
                            : 'border-white/10 bg-transparent text-white/55',
                        ].join(' ')}
                      >
                        {t('map_all_tags')}
                      </button>

                      {availableOptionChips.map((option) => {
                        const isActive = optionFilter === option

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              onOptionFilterChange(isActive ? 'all' : option)
                            }
                            className={[
                              'shrink-0 rounded-full border px-3 py-1.5 text-sm transition',
                              isActive
                                ? 'border-white/15 bg-white text-black'
                                : 'border-white/10 bg-transparent text-white/55',
                            ].join(' ')}
                          >
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-sm text-white/55">{t('map_live_results')}</div>
                  <div className="mt-1 flex items-center gap-3 text-sm">
                    <span className="font-semibold text-white">
                      {visiblePlacesCount}{' '}
                      {visiblePlacesCount === 1 ? t('map_place') : t('map_places')}
                    </span>
                    <span className="text-white/20">•</span>
                    <span className="text-white/70">
                      {props.visibleEventsCount}{' '}
                      {props.visibleEventsCount === 1 ? t('map_event') : t('map_events')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/80"
                  >
                    {t('map_reset')}
                  </button>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black"
                  >
                    {t('map_show_results')}
                  </button>
                </div>

                <div className="flex justify-center pt-1">
                  <LanguageSwitcher />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default function FilterBar(props: FilterBarProps) {
  if (props.isMobile) {
    return <MobileFilterBar {...props} />
  }

  return <DesktopFilterBar {...props} />
}