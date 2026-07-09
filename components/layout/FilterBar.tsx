'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
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

type TimeFilter = 'all' | 'tonight' | 'weekend' | 'week'

type LocationOption = {
  slug: string
  label: string
  country: string
  center?: [number, number]
}

type CountryCount = { country: string; count: number }

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
  onTimeFilterChange: (value: TimeFilter) => void
  onCategoryChange: (value: string) => void
  onSearchQueryChange: (value: string) => void
  onOptionFilterChange: (value: string) => void
  onLocationChange: (slug: string, center?: [number, number]) => void
  onReset: () => void
}

const categories = ['all', 'nightlife', 'music', 'sports', 'culture', 'food', 'civic']
const timeFilters: TimeFilter[] = ['tonight', 'weekend', 'week', 'all']

function getTimeFilterLabel(filter: TimeFilter) {
  if (filter === 'all') return 'All'
  if (filter === 'tonight') return 'Tonight'
  if (filter === 'week') return 'This Week'
  return 'This Weekend'
}

function getCategoryLabel(category: string) {
  if (category === 'all') return 'All'
  return category
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
                placeholder="Search events, cities, venues..."
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
                      Change location
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
                      placeholder="Search any city (e.g. Berlin)..."
                    />
                  </div>
                </>
              )}
            </div>
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
                  {getTimeFilterLabel(filter)}
                </button>
              )
            })}

            <span className="shrink-0 self-center px-1 text-white/15">·</span>

            {categories
              .filter((category) => category !== 'all')
              .map((category) => {
                const isActive = activeCategory === category
                const isCivic = category === 'civic'

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
                    {isCivic && <Flame className="h-3 w-3" />}
                    {getCategoryLabel(category)}
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
                Tags
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
                All tags
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
                All countries
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
              {visiblePlacesCount === 1 ? 'place' : 'places'}
              <span className="mx-1.5 text-white/20">·</span>
              <span className="font-semibold text-white/85">{visibleEventsCount}</span>{' '}
              {visibleEventsCount === 1 ? 'event' : 'events'}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs font-medium text-white/55 transition hover:text-white"
              >
                Reset
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
    locationOptions,
    visiblePlacesCount,
    visibleEventsCount,
    availableOptionChips,
    onTimeFilterChange,
    onCategoryChange,
    onSearchQueryChange,
    onOptionFilterChange,
    onLocationChange,
    onReset,
  } = props
  const totalResults = visiblePlacesCount + visibleEventsCount
  const resultsLabel =
    totalResults === 0
      ? 'No results'
      : totalResults === 1
        ? '1 result'
        : `${totalResults} results`

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [resolvedCity, setResolvedCity] = useState<ResolvedCity | null>(null)
  const popularCities = useMemo(() => toPopularCities(locationOptions), [locationOptions])

  const handleResolve = (resolved: ResolvedCity | null) => {
    setResolvedCity(resolved)
    if (resolved) {
      onLocationChange(resolved.slug, [resolved.lng, resolved.lat])
    }
  }

  const activeChips = useMemo(() => {
    const chips: string[] = []

    if (activeTimeFilter !== 'all') {
      chips.push(getTimeFilterLabel(activeTimeFilter))
    }

    if (activeCategory !== 'all') {
      chips.push(getCategoryLabel(activeCategory))
    }

    if (optionFilter !== 'all') {
      chips.push(optionFilter)
    }

    if (searchQuery.trim()) {
      chips.push(`"${searchQuery.trim()}"`)
    }

    return chips
  }, [activeTimeFilter, activeCategory, optionFilter, searchQuery])

  const activeFilterCount = activeChips.length

  const handleClose = () => setIsSheetOpen(false)

  const handleResetAndClose = () => {
    onReset()
    setIsSheetOpen(false)
  }

  return (
    <>
      <div className="absolute left-3 right-3 top-3 z-20 md:hidden">
        <div className="rounded-2xl border border-white/10 bg-ink-950/85 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Home"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/85 transition hover:bg-white/[0.08]"
            >
              <Home className="h-4 w-4" />
            </Link>

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search events, cities, venues..."
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-11 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-white/20 focus:bg-white/[0.06]"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => onSearchQueryChange('')}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/65 transition hover:bg-white/[0.12] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSheetOpen(true)}
              className="relative flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.08]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeChips.length > 0 ? (
              <>
                {activeChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setIsSheetOpen(true)}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80"
                  >
                    {chip}
                  </button>
                ))}

                <div className="shrink-0 rounded-full border border-flame-500/30 bg-flame-500/15 px-3 py-1.5 text-xs font-semibold text-flame-300">
                  {resultsLabel}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(true)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80"
                >
                  Explore
                </button>

                <div className="shrink-0 rounded-full border border-flame-500/30 bg-flame-500/15 px-3 py-1.5 text-xs font-semibold text-flame-300">
                  {resultsLabel}
                </div>
              </>
            )}
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
                  <h2 className="text-lg font-semibold text-white">Filters</h2>
                  <p className="text-sm text-white/45">
                    Refine your map view quickly
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
                  <FilterSectionTitle>Location</FilterSectionTitle>

                  <CitySearchInput
                    value={cityQuery}
                    onChange={setCityQuery}
                    onResolve={handleResolve}
                    resolved={resolvedCity}
                    popular={popularCities}
                    onPopularClick={(c) => onLocationChange(c.slug, [c.lng, c.lat])}
                    placeholder="Search any city (e.g. Berlin)..."
                  />
                </div>

                <div className="space-y-2">
                  <FilterSectionTitle>Search</FilterSectionTitle>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) =>
                        onSearchQueryChange(event.target.value)
                      }
                      placeholder="Search events, cities, venues..."
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
                  <FilterSectionTitle>Time</FilterSectionTitle>

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
                          {getTimeFilterLabel(filter)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <FilterSectionTitle>Category</FilterSectionTitle>

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
                          {getCategoryLabel(category)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {availableOptionChips.length > 0 && (
                  <div className="space-y-2">
                    <FilterSectionTitle>Tags</FilterSectionTitle>

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
                        All tags
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
                  <div className="text-sm text-white/55">Live results</div>
                  <div className="mt-1 flex items-center gap-3 text-sm">
                    <span className="font-semibold text-white">
                      {visiblePlacesCount} {visiblePlacesCount === 1 ? 'place' : 'places'}
                    </span>
                    <span className="text-white/20">•</span>
                    <span className="text-white/70">
                      {props.visibleEventsCount}{' '}
                      {props.visibleEventsCount === 1 ? 'event' : 'events'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/80"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black"
                  >
                    Show results
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