'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronDown,
  Globe,
  MapPin,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react'
import MiniCalendar from './MiniCalendar'
import { CATEGORIES, CATEGORY_ICONS, categoryLabel, getCategoryTone } from './categoryMeta'
import { getTodayDateString } from '@/lib/dateFilters'
import { languageLocales } from '@/lib/i18n/config'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { LocationOption } from '@/lib/locations'

export type TimeFilter = 'all' | 'tonight' | 'weekend'

export type SortBy = 'featured' | 'date-asc' | 'date-desc'

export type SearchSuggestion = {
  id: string
  title: string
  category: string
  location_slug: string
}

const SORT_OPTIONS: { value: SortBy; labelKey: string; hintKey: string }[] = [
  { value: 'featured', labelKey: 'filter_sort_featured', hintKey: 'filter_sort_featured_hint' },
  { value: 'date-asc', labelKey: 'filter_sort_soonest', hintKey: 'filter_sort_soonest_hint' },
  { value: 'date-desc', labelKey: 'filter_sort_latest', hintKey: 'filter_sort_latest_hint' },
]

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shortDate(dateStr: string, locale: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}

function titleizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

type PanelId = 'location' | 'date' | 'sort' | null

export type EventsFilterBarProps = {
  // Search
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearchSubmit: () => void
  suggestions: SearchSuggestion[]
  onPickSuggestion: (suggestion: SearchSuggestion) => void
  isSearchMode: boolean
  // Increment to scroll to + focus the search input (bottom-nav Search tab).
  searchFocusSignal?: number
  // Location
  locationOptions: LocationOption[]
  activeLocationSlug: string
  onLocationChange: (slug: string) => void
  // When
  timeFilter: TimeFilter
  onTimeFilterChange: (value: TimeFilter) => void
  dateFrom: string
  dateTo: string
  onDateRangeChange: (from: string, to: string) => void
  // Category
  activeCategory: string
  onCategoryChange: (category: string) => void
  // Tags
  availableTags: { tag: string; count: number }[]
  activeTags: Set<string>
  onToggleTag: (tag: string) => void
  // Sort
  sortBy: SortBy
  onSortChange: (value: SortBy) => void
  // Meta
  resultCount: number
  isLoading: boolean
  onClearAll: () => void
}

export default function EventsFilterBar(props: EventsFilterBarProps) {
  const {
    searchQuery,
    onSearchQueryChange,
    onSearchSubmit,
    suggestions,
    onPickSuggestion,
    isSearchMode,
    searchFocusSignal,
    locationOptions,
    activeLocationSlug,
    onLocationChange,
    timeFilter,
    onTimeFilterChange,
    dateFrom,
    dateTo,
    onDateRangeChange,
    activeCategory,
    onCategoryChange,
    availableTags,
    activeTags,
    onToggleTag,
    sortBy,
    onSortChange,
    resultCount,
    isLoading,
    onClearAll,
  } = props

  const { t, language } = useLanguage()
  const locale = languageLocales[language]

  const [openPanel, setOpenPanel] = useState<PanelId>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Bottom-nav Search tab: bring the search input into view and focus it.
  // A short delay lets the route transition settle first so the focus (and
  // the mobile keyboard, where the platform allows it) lands reliably.
  useEffect(() => {
    if (!searchFocusSignal) return
    const timer = setTimeout(() => {
      const input = searchInputRef.current
      if (!input) return
      input.scrollIntoView({ block: 'center', behavior: 'smooth' })
      input.focus()
    }, 250)
    return () => clearTimeout(timer)
  }, [searchFocusSignal])

  // Close popovers on outside click or Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenPanel(null)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSuggestOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPanel(null)
        setIsSuggestOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = isSheetOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isSheetOpen])

  const togglePanel = (id: Exclude<PanelId, null>) =>
    setOpenPanel((prev) => (prev === id ? null : id))

  const todayStr = getTodayDateString()
  const tomorrowStr = addDays(todayStr, 1)
  const next7EndStr = addDays(todayStr, 7)
  const hasRange = dateFrom !== '' || dateTo !== ''

  const locationLabel = useMemo(() => {
    if (activeLocationSlug === 'all') return null
    const match = locationOptions.find((l) => l.slug === activeLocationSlug)
    return match?.label ?? titleizeSlug(activeLocationSlug)
  }, [activeLocationSlug, locationOptions])

  const resolveLocationLabel = (slug: string) => {
    const match = locationOptions.find((l) => l.slug === slug)
    return match?.label ?? titleizeSlug(slug)
  }

  // Friendly labels always keep the calendar date next to them.
  const dateValue = useMemo(() => {
    if (hasRange) {
      if (dateFrom === tomorrowStr && dateTo === tomorrowStr) {
        return `${t('tomorrow')} · ${shortDate(tomorrowStr, locale)}`
      }
      if (dateFrom === todayStr && dateTo === next7EndStr) return t('filter_next_7_days')
      if (dateFrom && !dateTo) return `${t('filter_from')} ${shortDate(dateFrom, locale)}`
      if (!dateFrom && dateTo) return `${t('filter_until')} ${shortDate(dateTo, locale)}`
      if (dateFrom === dateTo) return shortDate(dateFrom, locale)
      return `${shortDate(dateFrom, locale)} – ${shortDate(dateTo, locale)}`
    }
    if (timeFilter === 'tonight') return `${t('tonight')} · ${shortDate(todayStr, locale)}`
    if (timeFilter === 'weekend') return t('filter_this_weekend')
    return null
  }, [hasRange, dateFrom, dateTo, timeFilter, todayStr, tomorrowStr, next7EndStr, t, locale])

  const sortOption = SORT_OPTIONS.find((o) => o.value === sortBy)
  const sortLabel = sortOption ? t(sortOption.labelKey) : t('filter_sort')

  type Chip = { key: string; label: string; onRemove: () => void }
  const chips = useMemo(() => {
    const list: Chip[] = []
    if (activeLocationSlug !== 'all' && locationLabel) {
      list.push({ key: 'location', label: locationLabel, onRemove: () => onLocationChange('all') })
    }
    if (dateValue) {
      list.push({
        key: 'date',
        label: dateValue,
        onRemove: () => {
          onTimeFilterChange('all')
          onDateRangeChange('', '')
        },
      })
    }
    if (activeCategory !== 'all') {
      list.push({
        key: 'category',
        label: categoryLabel(activeCategory, t),
        onRemove: () => onCategoryChange('all'),
      })
    }
    for (const tag of Array.from(activeTags).sort()) {
      list.push({ key: `tag-${tag}`, label: `#${tag}`, onRemove: () => onToggleTag(tag) })
    }
    if (sortBy !== 'featured') {
      list.push({ key: 'sort', label: sortLabel, onRemove: () => onSortChange('featured') })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocationSlug, locationLabel, dateValue, activeCategory, activeTags, sortBy, sortLabel, t])

  const activeFilterCount = chips.length

  const closeAndSelectLocation = (slug: string) => {
    onLocationChange(slug)
    setOpenPanel(null)
  }

  return (
    <>
      <div
        ref={barRef}
        className="sticky top-16 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          {/* Row 1 — search + popover controls + count */}
          <div className="flex items-center gap-2">
            <div ref={searchRef} className="relative min-w-0 flex-1 md:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => {
                  onSearchQueryChange(e.target.value)
                  setIsSuggestOpen(true)
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setIsSuggestOpen(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setIsSuggestOpen(false)
                    onSearchSubmit()
                  }
                }}
                placeholder={t('filter_search_placeholder')}
                aria-label={t('filter_search_events')}
                className="h-11 w-full rounded-full border border-white/10 bg-white/[0.04] pl-11 pr-9 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/25 focus:bg-white/[0.06]"
              />
              {searchQuery !== '' && (
                <button
                  type="button"
                  aria-label={t('filter_clear_search')}
                  onClick={() => {
                    onSearchQueryChange('')
                    setIsSuggestOpen(false)
                  }}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              <AnimatePresence>
                {isSuggestOpen && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl"
                  >
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onPickSuggestion(s)
                          setIsSuggestOpen(false)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-white/[0.06]"
                      >
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${getCategoryTone(s.category)}`}
                        >
                          {categoryLabel(s.category, t)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-white">
                          {s.title}
                        </span>
                        <span className="shrink-0 text-xs text-white/35">
                          {resolveLocationLabel(s.location_slug)}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop popover triggers */}
            <div className="relative hidden md:block">
              <FilterTrigger
                icon={MapPin}
                label={t('filter_city')}
                value={isSearchMode ? t('filter_all_cities') : locationLabel}
                isActive={!isSearchMode && activeLocationSlug !== 'all'}
                isOpen={openPanel === 'location'}
                disabled={isSearchMode}
                title={isSearchMode ? t('filter_search_covers_all') : undefined}
                onClick={() => togglePanel('location')}
              />
              <AnimatePresence>
                {openPanel === 'location' && (
                  <PopoverPanel width="w-80">
                    <LocationPicker
                      options={locationOptions}
                      activeSlug={activeLocationSlug}
                      onSelect={closeAndSelectLocation}
                      autoFocus
                    />
                  </PopoverPanel>
                )}
              </AnimatePresence>
            </div>

            <div className="relative hidden md:block">
              <FilterTrigger
                icon={CalendarDays}
                label={t('filter_date')}
                value={dateValue}
                isActive={dateValue !== null}
                isOpen={openPanel === 'date'}
                onClick={() => togglePanel('date')}
              />
              <AnimatePresence>
                {openPanel === 'date' && (
                  <PopoverPanel width="w-[21rem]">
                    <WhenPicker
                      timeFilter={timeFilter}
                      onTimeFilterChange={onTimeFilterChange}
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                      onDateRangeChange={onDateRangeChange}
                    />
                  </PopoverPanel>
                )}
              </AnimatePresence>
            </div>

            <div className="relative hidden md:block">
              <FilterTrigger
                icon={ArrowUpDown}
                label={t('filter_sort')}
                value={sortBy !== 'featured' ? sortLabel : null}
                isActive={sortBy !== 'featured'}
                isOpen={openPanel === 'sort'}
                onClick={() => togglePanel('sort')}
              />
              <AnimatePresence>
                {openPanel === 'sort' && (
                  <PopoverPanel width="w-64" align="right">
                    <SortPicker
                      sortBy={sortBy}
                      onSelect={(value) => {
                        onSortChange(value)
                        setOpenPanel(null)
                      }}
                    />
                  </PopoverPanel>
                )}
              </AnimatePresence>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span
                aria-live="polite"
                className="hidden h-11 items-center whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-white/75 lg:inline-flex"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                    {t('filter_loading')}
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-white">{resultCount}</span>
                    <span className="ml-1">
                      {resultCount === 1 ? t('event_singular') : t('event_plural')}
                    </span>
                  </>
                )}
              </span>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="hidden whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] text-white/50 underline-offset-4 transition hover:text-white hover:underline md:block"
                >
                  {t('filter_clear_all')}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsSheetOpen(true)}
                className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white md:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {t('filter_filters')}
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-flame-500 text-[10px] font-bold text-white shadow-glow-flame">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Row 2 — category rail */}
          <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat]
                const isActive = activeCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onCategoryChange(cat)}
                    className={[
                      'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium capitalize transition',
                      isActive
                        ? 'bg-flame-500 text-white shadow-glow-flame'
                        : 'border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                    {categoryLabel(cat, t)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Below the sticky bar — tags rail + active filter chips */}
      <div className="mx-auto max-w-6xl px-4">
        {availableTags.length > 0 && (
          <div className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                <Tag className="h-3.5 w-3.5" />
                {t('filter_tags')}
              </span>
              {availableTags.map(({ tag, count }) => {
                const isActive = activeTags.has(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    aria-pressed={isActive}
                    className={[
                      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition',
                      isActive
                        ? 'bg-flame-500/20 text-flame-100 ring-1 ring-flame-500/50'
                        : 'border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white',
                    ].join(' ')}
                  >
                    {tag}
                    <span
                      className={[
                        'rounded-full px-1.5 text-[10px]',
                        isActive
                          ? 'bg-flame-500/30 text-flame-50'
                          : 'bg-white/[0.06] text-white/45',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <AnimatePresence>
          {chips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 pt-4">
                <AnimatePresence mode="popLayout">
                  {chips.map((chip) => (
                    <motion.button
                      key={chip.key}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.14 }}
                      type="button"
                      onClick={chip.onRemove}
                      className="group inline-flex items-center gap-1.5 rounded-full bg-flame-500/10 px-3 py-1.5 text-xs font-medium text-flame-200 ring-1 ring-flame-500/30 transition hover:bg-flame-500/20"
                    >
                      {chip.label}
                      <X className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
                    </motion.button>
                  ))}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="ml-1 text-xs font-semibold text-white/50 underline-offset-4 transition hover:text-white hover:underline"
                >
                  {t('filter_clear_all')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile filter sheet */}
      <AnimatePresence>
        {isSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsSheetOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t('filter_filters')}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-3xl border-t border-white/10 bg-ink-950"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <span className="w-8" aria-hidden />
                <p className="text-sm font-semibold text-white">{t('filter_filters')}</p>
                <button
                  type="button"
                  aria-label={t('filter_close_filters')}
                  onClick={() => setIsSheetOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <section>
                  <SheetHeading>{t('filter_when')}</SheetHeading>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02]">
                    <WhenPicker
                      timeFilter={timeFilter}
                      onTimeFilterChange={onTimeFilterChange}
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                      onDateRangeChange={onDateRangeChange}
                    />
                  </div>
                </section>

                {!isSearchMode && (
                  <section>
                    <SheetHeading>{t('filter_city')}</SheetHeading>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                      <LocationPicker
                        options={locationOptions}
                        activeSlug={activeLocationSlug}
                        onSelect={onLocationChange}
                      />
                    </div>
                  </section>
                )}

                <section>
                  <SheetHeading>{t('filter_category')}</SheetHeading>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                      const Icon = CATEGORY_ICONS[cat]
                      const isActive = activeCategory === cat
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => onCategoryChange(cat)}
                          className={[
                            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium capitalize transition',
                            isActive
                              ? 'bg-flame-500 text-white shadow-glow-flame'
                              : 'border border-white/10 bg-white/[0.04] text-white/65',
                          ].join(' ')}
                        >
                          <Icon className="h-4 w-4" />
                          {categoryLabel(cat, t)}
                        </button>
                      )
                    })}
                  </div>
                </section>

                {availableTags.length > 0 && (
                  <section>
                    <SheetHeading>{t('filter_tags')}</SheetHeading>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {availableTags.map(({ tag, count }) => {
                        const isActive = activeTags.has(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => onToggleTag(tag)}
                            aria-pressed={isActive}
                            className={[
                              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition',
                              isActive
                                ? 'bg-flame-500/20 text-flame-100 ring-1 ring-flame-500/50'
                                : 'border border-white/10 bg-white/[0.04] text-white/65',
                            ].join(' ')}
                          >
                            {tag}
                            <span
                              className={[
                                'rounded-full px-1.5 text-[10px]',
                                isActive
                                  ? 'bg-flame-500/30 text-flame-50'
                                  : 'bg-white/[0.06] text-white/45',
                              ].join(' ')}
                            >
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}

                <section>
                  <SheetHeading>{t('filter_sort')}</SheetHeading>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                    <SortPicker sortBy={sortBy} onSelect={onSortChange} />
                  </div>
                </section>
              </div>

              <div className="flex items-center gap-3 border-t border-white/10 bg-ink-950 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4">
                <button
                  type="button"
                  onClick={onClearAll}
                  className="shrink-0 text-sm font-semibold text-white/60 underline-offset-4 transition hover:text-white hover:underline"
                >
                  {t('filter_clear_all')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  className="ml-auto flex-1 rounded-full bg-flame-500 px-6 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400"
                >
                  {isLoading
                    ? `${t('filter_loading')}…`
                    : `${t('filter_show')} ${resultCount} ${resultCount === 1 ? t('event_singular') : t('event_plural')}`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function SheetHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
      {children}
    </p>
  )
}

type FilterTriggerProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null
  isActive: boolean
  isOpen: boolean
  onClick: () => void
  disabled?: boolean
  title?: string
}

function FilterTrigger({
  icon: Icon,
  label,
  value,
  isActive,
  isOpen,
  onClick,
  disabled,
  title,
}: FilterTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-expanded={isOpen}
      className={[
        'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition',
        isOpen
          ? 'border-white/25 bg-white/[0.08] text-white'
          : isActive
            ? 'border-flame-500/40 bg-flame-500/10 text-flame-200'
            : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <Icon className="h-4 w-4 opacity-70" />
      <span className="max-w-[11rem] truncate">{value ?? label}</span>
      <ChevronDown
        className={`h-3.5 w-3.5 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
  )
}

function PopoverPanel({
  children,
  width = 'w-80',
  align = 'left',
}: {
  children: React.ReactNode
  width?: string
  align?: 'left' | 'right'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className={[
        'absolute top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl',
        width,
        align === 'right' ? 'right-0' : 'left-0',
      ].join(' ')}
    >
      {children}
    </motion.div>
  )
}

function LocationPicker({
  options,
  activeSlug,
  onSelect,
  autoFocus,
}: {
  options: LocationOption[]
  activeSlug: string
  onSelect: (slug: string) => void
  autoFocus?: boolean
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((l) => `${l.label} ${l.country}`.toLowerCase().includes(q))
    : options

  return (
    <div>
      <div className="border-b border-white/10 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('filter_search_city_placeholder')}
            aria-label={t('filter_search_city_placeholder')}
            autoFocus={autoFocus}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/25"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {!q && (
          <LocationRow
            icon={Globe}
            label={t('filter_all_cities')}
            sub={t('filter_worldwide')}
            active={activeSlug === 'all'}
            onClick={() => onSelect('all')}
          />
        )}
        {filtered.map((loc) => (
          <LocationRow
            key={loc.slug}
            icon={MapPin}
            label={loc.label}
            sub={loc.country}
            active={activeSlug === loc.slug}
            onClick={() => onSelect(loc.slug)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-white/40">
            {t('filter_no_city_match')} &ldquo;{query}&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}

function LocationRow({
  icon: Icon,
  label,
  sub,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  sub: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]',
        active ? 'bg-white/[0.05]' : '',
      ].join(' ')}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
        <Icon className="h-4 w-4 text-white/60" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{label}</span>
        {sub && <span className="block truncate text-xs text-white/40">{sub}</span>}
      </span>
      {active && <Check className="h-4 w-4 shrink-0 text-flame-400" />}
    </button>
  )
}

function WhenPicker({
  timeFilter,
  onTimeFilterChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
}: {
  timeFilter: TimeFilter
  onTimeFilterChange: (value: TimeFilter) => void
  dateFrom: string
  dateTo: string
  onDateRangeChange: (from: string, to: string) => void
}) {
  const { t } = useLanguage()
  const todayStr = getTodayDateString()
  const tomorrowStr = addDays(todayStr, 1)
  const next7EndStr = addDays(todayStr, 7)
  const hasRange = dateFrom !== '' || dateTo !== ''

  const presets: { key: string; label: string; active: boolean; apply: () => void }[] = [
    {
      key: 'any',
      label: t('filter_any_date'),
      active: !hasRange && timeFilter === 'all',
      apply: () => {
        onTimeFilterChange('all')
        onDateRangeChange('', '')
      },
    },
    {
      key: 'tonight',
      label: t('tonight'),
      active: !hasRange && timeFilter === 'tonight',
      apply: () => {
        onTimeFilterChange('tonight')
        onDateRangeChange('', '')
      },
    },
    {
      key: 'tomorrow',
      label: t('tomorrow'),
      active: dateFrom === tomorrowStr && dateTo === tomorrowStr,
      apply: () => {
        onTimeFilterChange('all')
        onDateRangeChange(tomorrowStr, tomorrowStr)
      },
    },
    {
      key: 'weekend',
      label: t('filter_this_weekend'),
      active: !hasRange && timeFilter === 'weekend',
      apply: () => {
        onTimeFilterChange('weekend')
        onDateRangeChange('', '')
      },
    },
    {
      key: 'week',
      label: t('filter_next_7_days'),
      active: dateFrom === todayStr && dateTo === next7EndStr,
      apply: () => {
        onTimeFilterChange('all')
        onDateRangeChange(todayStr, next7EndStr)
      },
    },
  ]

  return (
    <div className="p-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={preset.apply}
            aria-pressed={preset.active}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-medium transition',
              preset.active
                ? 'bg-white text-black'
                : 'border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white',
            ].join(' ')}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        <MiniCalendar
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => {
            onTimeFilterChange('all')
            onDateRangeChange(from, to)
          }}
        />
      </div>

      {hasRange && (
        <button
          type="button"
          onClick={() => onDateRangeChange('', '')}
          className="mt-2 w-full rounded-xl border border-white/10 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-flame-300 transition hover:bg-white/[0.04] hover:text-flame-200"
        >
          {t('filter_clear_dates')}
        </button>
      )}
    </div>
  )
}

function SortPicker({
  sortBy,
  onSelect,
}: {
  sortBy: SortBy
  onSelect: (value: SortBy) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="p-1.5">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={[
            'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]',
            opt.value === sortBy ? 'bg-white/[0.05] text-white' : 'text-white/70',
          ].join(' ')}
        >
          <span>
            <span className="block font-medium">{t(opt.labelKey)}</span>
            <span className="block text-xs text-white/40">{t(opt.hintKey)}</span>
          </span>
          {opt.value === sortBy && <Check className="h-4 w-4 shrink-0 text-flame-400" />}
        </button>
      ))}
    </div>
  )
}
