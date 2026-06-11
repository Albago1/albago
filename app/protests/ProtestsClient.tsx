'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Calendar,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  Compass,
  Globe2,
  Heart,
  History,
  Info,
  MapPin,
  Radio,
  Search,
  X,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { Reveal } from '@/components/cinematic/Reveal'
import { SectionLabel } from '@/components/cinematic/SectionLabel'
import { CinematicLink } from '@/components/cinematic/CinematicButton'
import ProtestMap from '@/components/protest/ProtestMap'
import ProtestEventCard, {
  type ProtestEvent,
  formatProtestNumber,
} from '@/components/protest/ProtestEventCard'
import SafetyPanel from '@/components/protest/SafetyPanel'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

type RealtimeEventRow = {
  id: string
  slug: string
  title: string
  description: string
  date: string
  time: string
  category: string
  price: string | null
  highlight: boolean | null
  place_id: string | null
  location_slug: string
  country: string
  region: string | null
  lat: number | null
  lng: number | null
  status: string
  event_type: string | null
  is_civic: boolean | null
  featured_movement_slug: string | null
  organizer_contact: string | null
  telegram_link: string | null
  whatsapp_link: string | null
  safety_notes: string | null
  expected_attendees: number | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
}

function rowToProtestEvent(row: RealtimeEventRow): ProtestEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.date,
    time: row.time,
    category: row.category,
    price: row.price ?? null,
    highlight: row.highlight ?? false,
    placeId: row.place_id,
    placeName: null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    address: null,
    locationSlug: row.location_slug,
    country: row.country,
    region: row.region ?? null,
    eventType: row.event_type ?? null,
    isCivic: row.is_civic ?? false,
    organizerContact: row.organizer_contact ?? null,
    telegramLink: row.telegram_link ?? null,
    whatsappLink: row.whatsapp_link ?? null,
    safetyNotes: row.safety_notes ?? null,
    expectedAttendees: row.expected_attendees ?? null,
    recurrence: row.recurrence ?? null,
    recurrenceUntil: row.recurrence_until ?? null,
    recurrenceDaysOfWeek: row.recurrence_days_of_week ?? null,
    recurrenceExceptions: row.recurrence_exceptions ?? null,
  }
}

type Props = {
  events: ProtestEvent[]
  migrationApplied: boolean
}

type DateFilter = 'upcoming' | 'today' | 'week' | 'past'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function ProtestsClient({ events, migrationApplied }: Props) {
  const { t } = useLanguage()
  const [list, setList] = useState<ProtestEvent[]>(events)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const showEmptyBanner = list.length === 0

  // Sync to fresh server props on navigation.
  useEffect(() => {
    setList(events)
  }, [events])

  // Subscribe to changes on civic events so the directory + map auto-update
  // as soon as an admin publishes (or rejects) a protest.
  useEffect(() => {
    if (!migrationApplied) return
    const supabase = createClient()
    const channel = supabase
      .channel('protests-civic-stream')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: 'is_civic=eq.true',
        },
        (payload) => {
          const newRow = payload.new as RealtimeEventRow | null
          const oldRow = payload.old as Pick<RealtimeEventRow, 'id'> | null

          if (payload.eventType === 'DELETE') {
            if (oldRow?.id) {
              setList((prev) => prev.filter((e) => e.id !== oldRow.id))
            }
            return
          }

          if (!newRow) return
          const isPublishedCivic = newRow.status === 'published' && newRow.is_civic === true
          const mapped = rowToProtestEvent(newRow)
          setList((prev) => {
            const without = prev.filter((e) => e.id !== newRow.id)
            return isPublishedCivic ? [...without, mapped] : without
          })
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [migrationApplied])

  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [countryOpen, setCountryOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>('upcoming')
  const [searchCenter, setSearchCenter] = useState<
    { lat: number; lng: number; label: string } | null
  >(null)
  const [searching, setSearching] = useState(false)

  const countries = useMemo(() => {
    const set = new Set(list.map((e) => e.country))
    return Array.from(set).sort()
  }, [list])

  const totalCities = useMemo(
    () => new Set(list.map((e) => e.locationSlug)).size,
    [list],
  )

  const filtered = useMemo(() => {
    const today = todayIso()
    const weekEnd = addDaysIso(7)
    const q = query.trim().toLowerCase()

    return list.filter((e) => {
      // Date window
      if (dateFilter === 'upcoming' && e.date < today) return false
      if (dateFilter === 'today' && e.date !== today) return false
      if (dateFilter === 'week' && (e.date < today || e.date > weekEnd)) return false
      if (dateFilter === 'past' && e.date >= today) return false

      if (countryFilter && e.country !== countryFilter) return false

      if (!q) return true
      const haystack =
        `${e.placeName ?? ''} ${e.locationSlug} ${e.country} ${e.region ?? ''} ${e.title}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [list, query, countryFilter, dateFilter])

  const filteredAttendees = useMemo(
    () => filtered.reduce((sum, e) => sum + (e.expectedAttendees ?? 0), 0),
    [filtered],
  )

  const mapMarkers = useMemo(
    () =>
      filtered
        .filter((e) => e.lat != null && e.lng != null)
        .map((e) => ({
          id: e.id,
          name: e.title,
          city: e.placeName ?? e.locationSlug,
          country: e.country,
          lat: e.lat as number,
          lng: e.lng as number,
          slug: e.slug,
        })),
    [filtered],
  )

  // Debounced geocoding via Nominatim. When the typed city is not in our
  // dataset, fly the map there so the user can still see "their" place.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSearchCenter(null)
      setSearching(false)
      return
    }
    const local = list.find((e) => {
      if (e.lat == null || e.lng == null) return false
      const haystack = `${e.placeName ?? ''} ${e.locationSlug} ${e.country}`.toLowerCase()
      return haystack.includes(q.toLowerCase())
    })
    if (local && local.lat != null && local.lng != null) {
      setSearchCenter({
        lat: local.lat,
        lng: local.lng,
        label: local.placeName?.split('â€”')[0]?.trim() || local.country,
      })
      setSearching(false)
      return
    }
    setSearching(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`,
          { signal: ctrl.signal, headers: { Accept: 'application/json' } },
        )
        if (!res.ok) {
          setSearchCenter(null)
          return
        }
        const data = (await res.json()) as Array<{
          lat: string
          lon: string
          display_name: string
        }>
        if (Array.isArray(data) && data[0]) {
          const parts = data[0].display_name.split(',').map((s) => s.trim())
          const label =
            parts.length >= 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts[0]
          setSearchCenter({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            label,
          })
        } else {
          setSearchCenter(null)
        }
      } catch {
        // aborted or network error â€” silent
      } finally {
        setSearching(false)
      }
    }, 500)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, list])

  const dateOptions: { value: DateFilter; label: string; icon: typeof Calendar }[] = [
    { value: 'upcoming', label: t('protests_filter_upcoming'), icon: CalendarClock },
    { value: 'today', label: t('protests_filter_today'), icon: Calendar },
    { value: 'week', label: t('protests_filter_week'), icon: CalendarRange },
    { value: 'past', label: t('protests_filter_past'), icon: History },
  ]

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      {/* Hero â€” compact directory header */}
      <section className="relative isolate overflow-hidden pt-28 sm:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink-950 to-transparent" />
        </div>

        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 pb-10 sm:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs backdrop-blur"
          >
            <Globe2 className="h-3.5 w-3.5 text-flame-400" />
            <span className="text-white/80">{t('protests_meta_badge')}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="display-text text-4xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight"
          >
            {t('protests_hero_title_pre')}{' '}
            <span className="italic text-flame-400">{t('protests_hero_title_emph')}</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/65"
          >
            {t('protests_hero_subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-8 inline-flex flex-wrap items-center gap-2 text-xs text-white/55"
          >
            <span>
              <span className="font-semibold text-white">{list.length}</span>{' '}
              {t('protests_count_gatherings')}
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span>
              <span className="font-semibold text-white">{totalCities}</span>{' '}
              {t('protests_count_cities')}
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span>
              <span className="font-semibold text-white">{countries.length}</span>{' '}
              {t('protests_count_countries')}
            </span>
            {realtimeConnected && (
              <>
                <span className="h-3 w-px bg-white/15" />
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/30"
                  title="Auto-updating as new protests are published"
                >
                  <span className="relative inline-flex h-2 w-2 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <Radio className="h-3 w-3" />
                  {t('protests_live')}
                </span>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {showEmptyBanner && (
        <section className="px-5 sm:px-8 pb-2">
          <div className="mx-auto max-w-7xl rounded-2xl border border-flame-500/30 bg-flame-500/[0.06] px-5 py-4 text-sm text-flame-200">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-flame-400" />
              <div>
                <p className="font-semibold text-white">
                  {migrationApplied
                    ? t('protests_empty_no_civic_title')
                    : t('protests_empty_schema_title')}
                </p>
                <p className="mt-1 text-white/70">
                  {migrationApplied ? (
                    <>
                      {t('protests_empty_register_hint_pre')}{' '}
                      <Link href="/submit-event" className="underline">
                        /submit-event
                      </Link>{' '}
                      {t('protests_empty_register_hint_post')}
                    </>
                  ) : (
                    t('protests_empty_apply_migration')
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search + filters + map + list */}
      <section className="relative pb-24 sm:pb-32 pt-6 sm:pt-8 px-5 sm:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Filter bar */}
          <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4 backdrop-blur">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('protests_search_placeholder')}
                  className="w-full rounded-xl bg-ink-950/60 border border-white/[0.06] py-3 pl-11 pr-10 text-sm text-white placeholder:text-white/35 focus:border-flame-500/50 focus:outline-none focus:ring-2 focus:ring-flame-500/20 transition"
                />
                {searching && (
                  <span className="absolute right-12 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-flame-500/30 border-t-flame-500" />
                )}
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('protests_clear_search')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] p-1 text-white/45 hover:bg-white/[0.08] hover:text-white transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Date range chips */}
              <div className="flex flex-wrap items-center gap-2">
                {dateOptions.map((opt) => {
                  const Icon = opt.icon
                  const active = dateFilter === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDateFilter(opt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? 'bg-flame-500 text-white shadow-glow-flame'
                          : 'bg-white/[0.04] text-white/65 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {/* Country picker — collapsed by default */}
              {countries.length > 1 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setCountryOpen((v) => !v)}
                    className="inline-flex w-full items-center justify-between gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white sm:w-auto"
                    aria-expanded={countryOpen}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Globe2 className="h-3.5 w-3.5 text-flame-300" />
                      {countryFilter ? (
                        <>
                          Country:{' '}
                          <span className="text-flame-200">{countryFilter}</span>
                        </>
                      ) : (
                        <>
                          {t('protests_all_countries')}{' '}
                          <span className="text-white/45">({countries.length})</span>
                        </>
                      )}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${
                        countryOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {countryOpen && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCountryFilter(null)
                          setCountryOpen(false)
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          countryFilter === null
                            ? 'bg-white/10 text-white ring-1 ring-white/25'
                            : 'bg-white/[0.04] text-white/65 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        {t('protests_all_countries')}
                      </button>
                      {countries.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCountryFilter(countryFilter === c ? null : c)
                            setCountryOpen(false)
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            countryFilter === c
                              ? 'bg-flame-500/15 text-flame-100 ring-1 ring-flame-500/40'
                              : 'bg-white/[0.04] text-white/65 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-white/55 px-1">
                <span>
                  <span className="font-semibold text-white">{filtered.length}</span>{' '}
                  {filtered.length === 1
                    ? t('protests_count_gathering_singular')
                    : t('protests_count_gatherings')}
                </span>
                <span className="h-3 w-px bg-white/15" />
                <span>
                  <span className="font-semibold text-white">
                    {formatProtestNumber(filteredAttendees)}
                  </span>{' '}
                  {t('protests_count_expected')}
                </span>
              </div>
            </div>
          </div>

          {/* World map */}
          <div className="mb-8">
            <ProtestMap
              markers={mapMarkers}
              flyTo={searchCenter}
              defaultCenter={[10, 30]}
              defaultZoom={1.6}
            />
          </div>

          {/* Cards or empty state */}
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-flame-500/20 bg-gradient-to-br from-flame-500/[0.06] to-transparent p-8 sm:p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-flame-500/15 text-flame-300">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="display-text mt-6 text-2xl sm:text-3xl">
                {t('protests_empty_no_match_pre')}{' '}
                <span className="italic text-flame-400">
                  {searchCenter?.label || query.trim() || countryFilter || t('protests_empty_this_filter')}
                </span>{' '}
                {t('protests_empty_no_match_post')}
              </h3>
              <p className="mt-4 text-sm sm:text-base text-white/65 max-w-md mx-auto">
                {searchCenter
                  ? t('protests_empty_found_city')
                  : t('protests_empty_be_first')}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <CinematicLink href="/submit-event" variant="primary" size="md">
                  {t('protests_empty_register_first')}
                </CinematicLink>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setCountryFilter(null)
                    setDateFilter('upcoming')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-4 py-2 text-sm text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] transition"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('protests_empty_clear_filters')}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((event) => (
                <ProtestEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Spotlight: Albanian Revolution campaign */}
      <section className="relative pb-24 sm:pb-32 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-flame-500/15 via-flame-500/5 to-transparent p-8 sm:p-12">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-flame-500/25 blur-3xl" />
            </div>
            <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-8 items-end">
              <div>
                <Reveal>
                  <SectionLabel>{t('protests_spotlight_label')}</SectionLabel>
                </Reveal>
                <Reveal delay={0.1}>
                  <h2 className="display-text mt-5 text-3xl sm:text-4xl lg:text-5xl">
                    {t('protests_spotlight_title_pre')}{' '}
                    <span className="italic text-flame-400">{t('protests_spotlight_title_emph')}</span>.
                  </h2>
                </Reveal>
                <Reveal delay={0.2}>
                  <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">
                    {t('protests_spotlight_subtitle')}
                  </p>
                </Reveal>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <CinematicLink href="/events/albanian-revolution" variant="primary" size="md">
                  {t('protests_spotlight_open')}
                </CinematicLink>
                <CinematicLink href="/submit-event" variant="secondary" size="md">
                  {t('protests_spotlight_register')}
                </CinematicLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & legality â€” shared component */}
      <section className="relative px-5 pb-16 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <SafetyPanel compact />
        </div>
      </section>

      {/* Helper strip */}
      <section className="relative pb-24 px-5 sm:px-8">
        <div className="mx-auto max-w-5xl grid sm:grid-cols-3 gap-4">
          {[
            {
              href: null,
              icon: MapPin,
              title: t('protests_helper_map_title'),
              body: t('protests_helper_map_body'),
            },
            {
              href: null,
              icon: Search,
              title: t('protests_helper_search_title'),
              body: t('protests_helper_search_body'),
            },
            {
              href: '/volunteer',
              icon: Heart,
              title: t('protests_helper_volunteer_title'),
              body: t('protests_helper_volunteer_body'),
            },
          ].map((card) => {
            const Icon = card.icon
            const inner = (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame-500/15 text-flame-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{card.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-white/60">{card.body}</p>
              </>
            )
            return card.href ? (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:border-flame-500/40 hover:bg-white/[0.04]"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={card.title}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                {inner}
              </div>
            )
          })}
        </div>
        <div className="mx-auto mt-6 max-w-5xl flex flex-wrap items-center justify-center gap-3 text-center text-xs text-white/45">
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-4 py-2 text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white transition"
          >
            <MapPin className="h-3.5 w-3.5" />
            {t('protests_open_full_map')}
          </Link>
          <Link
            href="/submit-event"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-4 py-2 text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white transition"
          >
            <Compass className="h-3.5 w-3.5" />
            {t('protests_register_gathering')}
          </Link>
        </div>
      </section>
    </div>
  )
}
