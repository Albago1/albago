'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  animate,
  useMotionValue,
} from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  Compass,
  Flag,
  Heart,
  Info,
  MapPin,
  Search,
  Share2,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { Reveal } from '@/components/cinematic/Reveal'
import { SectionLabel } from '@/components/cinematic/SectionLabel'
import { CinematicLink } from '@/components/cinematic/CinematicButton'
import ProtestMap from '@/components/protest/ProtestMap'
import ProtestEventCard, {
  type ProtestEvent,
} from '@/components/protest/ProtestEventCard'
import SafetyPanel from '@/components/protest/SafetyPanel'

export type MovementEvent = ProtestEvent

type Props = {
  events: MovementEvent[]
  migrationApplied: boolean
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return value.toLocaleString()
}

export default function AlbanianRevolutionClient({ events, migrationApplied }: Props) {
  const list = events
  const showEmptyBanner = events.length === 0

  const heroRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '40%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  const stats = useMemo(() => {
    const cities = new Set(list.map((e) => e.locationSlug)).size
    const countries = new Set(list.map((e) => e.country)).size
    const attending = list.reduce((sum, e) => sum + (e.expectedAttendees ?? 0), 0)
    return { cities, countries, attending, events: list.length }
  }, [list])

  const featuredCities = useMemo(() => {
    const byCity = new Map<string, { name: string; country: string; events: number; attendees: number }>()
    for (const event of list) {
      const key = event.locationSlug
      const existing = byCity.get(key)
      if (existing) {
        existing.events += 1
        existing.attendees += event.expectedAttendees ?? 0
      } else {
        const cityLabel = event.placeName?.split(',')[0]?.trim() ||
          event.locationSlug
            .split('-')
            .map((s) => s[0]?.toUpperCase() + s.slice(1))
            .join(' ')
        byCity.set(key, {
          name: cityLabel,
          country: event.country,
          events: 1,
          attendees: event.expectedAttendees ?? 0,
        })
      }
    }
    return Array.from(byCity.values())
      .sort((a, b) => b.attendees - a.attendees)
      .slice(0, 6)
  }, [list])

  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [searching, setSearching] = useState(false)

  const countries = useMemo(() => {
    const set = new Set(list.map((e) => e.country))
    return Array.from(set).sort()
  }, [list])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((e) => {
      if (countryFilter && e.country !== countryFilter) return false
      if (!q) return true
      const haystack =
        `${e.placeName ?? ''} ${e.locationSlug} ${e.country} ${e.region ?? ''} ${e.title}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [list, query, countryFilter])

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
          date: e.date,
          time: e.time,
          expectedAttendees: e.expectedAttendees ?? null,
        })),
    [filtered],
  )

  // Debounced geocoding: when the user types something we don't have a protest
  // for, hit OpenStreetMap Nominatim to resolve it to lat/lng + a nice label,
  // and fly the map there. Cities that already match a local protest skip the
  // network call. This is what makes the search feel like a real "anywhere" finder.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSearchCenter(null)
      setSearching(false)
      return
    }
    // Local-first: if any of our seeded protests already match the query, use
    // that lat/lng directly (instant, no network).
    const local = list.find((e) => {
      if (e.lat == null || e.lng == null) return false
      const haystack = `${e.placeName ?? ''} ${e.locationSlug} ${e.country}`.toLowerCase()
      return haystack.includes(q.toLowerCase())
    })
    if (local && local.lat != null && local.lng != null) {
      setSearchCenter({
        lat: local.lat,
        lng: local.lng,
        label: local.placeName?.split('—')[0]?.trim() || local.country,
      })
      setSearching(false)
      return
    }
    // Remote geocode via Nominatim.
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
        const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
        if (Array.isArray(data) && data[0]) {
          const parts = data[0].display_name.split(',').map((s) => s.trim())
          const label = parts.length >= 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts[0]
          setSearchCenter({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            label,
          })
        } else {
          setSearchCenter(null)
        }
      } catch {
        // Aborted or network error — silently ignore.
      } finally {
        setSearching(false)
      }
    }, 500)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, list])

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24"
      >
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-60" />
          <div className="absolute inset-0 bg-radial-flame" />
          <motion.div
            className="absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-flame-500/20 blur-3xl"
            animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink-950 to-transparent" />
        </motion.div>

        <div className="pointer-events-none absolute inset-0 -z-10">
          {[
            { top: '18%', left: '8%' },
            { top: '32%', left: '22%' },
            { top: '60%', left: '15%' },
            { top: '24%', left: '78%' },
            { top: '50%', left: '88%' },
            { top: '72%', left: '70%' },
            { top: '40%', left: '52%' },
          ].map((p, i) => (
            <motion.span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-flame-400 shadow-[0_0_18px_4px_rgba(238,28,37,0.55)]"
              style={p}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 2 + (i % 3),
                repeat: Infinity,
                delay: i * 0.3,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-flame-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flame-500" />
            </span>
            <span className="text-white/80">Peaceful · Lawful · Worldwide</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="display-text text-5xl sm:text-7xl lg:text-[110px] xl:text-[128px] leading-[0.92] tracking-tight"
          >
            One nation.
            <br />
            <span className="italic text-white/90">One breath.</span>
            <br />
            <span className="shine-text">The world is listening.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="mt-10 max-w-2xl text-lg leading-relaxed text-white/65"
          >
            A worldwide civic campaign coordinated through AlbaGo — for the peaceful, lawful
            organization of Albanian protests and movements. Find a square near you, organize
            your city, or stand with the diaspora — calmly, openly, together.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.32 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <CinematicLink href="/events?category=civic" variant="primary" size="lg">
              Find a protest
            </CinematicLink>
            <CinematicLink href="/submit-event" variant="secondary" size="lg">
              Register a protest
            </CinematicLink>
            <CinematicLink href="/volunteer?movement=albanian-revolution" variant="ghost" size="lg">
              Volunteer
            </CinematicLink>
            <CinematicLink href="/pankartat" variant="ghost" size="lg">
              Pankartat e Revolucionit
            </CinematicLink>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-16 grid max-w-3xl grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur"
          >
            {[
              { label: 'Cities', value: stats.cities.toString() },
              { label: 'Countries', value: stats.countries.toString() },
              { label: 'Attending', value: formatNumber(stats.attending) },
              { label: 'Active events', value: stats.events.toString() },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-ink-950/40 px-5 py-5 sm:py-6 hover:bg-white/[0.03] transition-colors"
              >
                <div className="font-display text-3xl sm:text-4xl text-white">{s.value}</div>
                <div className="kicker mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {showEmptyBanner && (
        <section className="px-5 sm:px-8 pb-6">
          <div className="mx-auto max-w-5xl rounded-2xl border border-flame-500/30 bg-flame-500/[0.06] px-5 py-4 text-sm text-flame-200">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-flame-400" />
              <div>
                <p className="font-semibold text-white">
                  {migrationApplied
                    ? 'No gatherings registered for this movement yet.'
                    : 'Civic schema not enabled.'}
                </p>
                <p className="mt-1 text-white/70">
                  {migrationApplied ? (
                    <>
                      Submit a peaceful gathering with{' '}
                      <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">
                        {`featured_movement_slug = 'albanian-revolution'`}
                      </code>{' '}
                      via{' '}
                      <Link href="/submit-event" className="underline">
                        /submit-event
                      </Link>{' '}
                      and it will show up here once approved.
                    </>
                  ) : (
                    'Apply the SQL migration in docs/phase-8-civic-events-plan.md to enable civic fields, then seed rows.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Mission */}
      <section className="relative py-24 sm:py-32 px-5 sm:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal>
            <SectionLabel align="center">Mission</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display-text mt-6 text-4xl sm:text-5xl lg:text-6xl">
              Civic energy, organized <span className="italic text-flame-400">with care</span>.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-8 mx-auto max-w-2xl text-lg leading-relaxed text-white/65">
              This is not a campaign of anger. It is a campaign of attention. Peaceful gatherings,
              lawful organization, kind conduct in public squares — coordinated worldwide through
              AlbaGo so every voice can be counted, and every city can find its people.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Heart, title: 'Peaceful', body: 'No violence. No intimidation. Kindness in every square.' },
              { icon: Shield, title: 'Lawful', body: 'Coordinated with local authorities wherever required.' },
              { icon: Flag, title: 'Inclusive', body: 'Open to every citizen and every supporting voice.' },
            ].map((card) => {
              const Icon = card.icon
              return (
                <Reveal key={card.title} delay={0.1}>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-left">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame-500/15 text-flame-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">{card.body}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* Movement counter — live ticking number */}
      <MovementCounter target={stats.attending} />

      {/* Featured cities */}
      <section className="relative py-24 sm:py-32 px-5 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 sm:mb-16 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-5 max-w-xl">
              <SectionLabel>Spotlight cities</SectionLabel>
              <h2 className="display-text text-4xl sm:text-5xl lg:text-6xl">
                Squares becoming <span className="italic text-flame-400">landmarks</span>.
              </h2>
            </div>
            <Link
              href="/events?category=civic"
              className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
            >
              All civic events
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredCities.map((c, i) => (
              <motion.article
                key={c.name + c.country}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-7 transition-all duration-500 hover:border-flame-500/40 hover:-translate-y-1"
              >
                <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-flame-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-3xl text-white">{c.name}</h3>
                    <p className="text-xs text-white/45 mt-0.5">{c.country}</p>
                  </div>
                  <span className="kicker text-white/35">#{i + 1}</span>
                </div>
                <div className="relative mt-8 flex items-center justify-between border-t border-white/[0.06] pt-5">
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5 text-white/70">
                      <Users className="h-4 w-4 text-flame-400" />
                      <span className="text-sm font-medium">{formatNumber(c.attendees)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/70">
                      <Calendar className="h-4 w-4 text-flame-400" />
                      <span className="text-sm font-medium">{c.events} event{c.events !== 1 && 's'}</span>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Find your square — unified search, map, and gathering list */}
      <section className="relative py-24 sm:py-32 px-5 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 sm:mb-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-5 max-w-xl">
              <SectionLabel>Find your square</SectionLabel>
              <h2 className="display-text text-4xl sm:text-5xl lg:text-6xl">
                A square <span className="italic text-flame-400">near you</span>.
              </h2>
            </div>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.08] hover:text-white transition"
            >
              <MapPin className="h-4 w-4" />
              Open the full AlbaGo map
            </Link>
          </div>

          {/* Filter bar */}
          <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4 backdrop-blur">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a city or country — try Milano, Berlin, New York…"
                  className="w-full rounded-xl bg-ink-950/60 border border-white/[0.06] py-3 pl-11 pr-10 text-sm text-white placeholder:text-white/35 focus:border-flame-500/50 focus:outline-none focus:ring-2 focus:ring-flame-500/20 transition"
                />
                {searching && (
                  <span className="absolute right-12 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-flame-500/30 border-t-flame-500" />
                )}
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] p-1 text-white/45 hover:bg-white/[0.08] hover:text-white transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {countries.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCountryFilter(null)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      countryFilter === null
                        ? 'bg-flame-500 text-white shadow-glow-flame'
                        : 'bg-white/[0.04] text-white/65 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    All countries
                  </button>
                  {countries.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCountryFilter(countryFilter === c ? null : c)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        countryFilter === c
                          ? 'bg-flame-500 text-white shadow-glow-flame'
                          : 'bg-white/[0.04] text-white/65 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-white/55 px-1">
                <span>
                  <span className="font-semibold text-white">{filtered.length}</span>{' '}
                  gathering{filtered.length !== 1 && 's'}
                </span>
                <span className="h-3 w-px bg-white/15" />
                <span>
                  <span className="font-semibold text-white">{formatNumber(filteredAttendees)}</span>{' '}
                  expected
                </span>
              </div>
            </div>
          </div>

          {/* Map (auto-fits to filtered markers, or flies to the geocoded search). */}
          <div className="mb-8">
            <ProtestMap markers={mapMarkers} flyTo={searchCenter} />
          </div>

          {/* Cards or empty state */}
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-flame-500/20 bg-gradient-to-br from-flame-500/[0.06] to-transparent p-8 sm:p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-flame-500/15 text-flame-300">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="display-text mt-6 text-2xl sm:text-3xl">
                No gathering in{' '}
                <span className="italic text-flame-400">
                  {searchCenter?.label || query.trim() || countryFilter || 'this filter'}
                </span>{' '}
                yet.
              </h3>
              <p className="mt-4 text-sm sm:text-base text-white/65 max-w-md mx-auto">
                {searchCenter
                  ? 'We found your city on the map above. Be the first to register a peaceful gathering there — AlbaGo will help you organize it, safely and lawfully.'
                  : 'Be the first to register a peaceful gathering for your city. AlbaGo will help you organize it — safely and lawfully.'}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <CinematicLink href="/submit-event" variant="primary" size="md">
                  Register the first one
                </CinematicLink>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setCountryFilter(null)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-4 py-2 text-sm text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] transition"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
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

      {/* Volunteer */}
      <section className="relative py-24 sm:py-32 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-start">
            <div>
              <SectionLabel>Volunteer</SectionLabel>
              <h2 className="display-text mt-6 text-4xl sm:text-5xl lg:text-6xl">
                The movement is <span className="italic text-flame-400">built by people</span>.
              </h2>
              <p className="mt-8 text-lg leading-relaxed text-white/65 max-w-xl">
                A few hours of your time goes a long way. Marshall a square, translate an open
                letter, design a poster, edit a video, or simply make sure your neighbourhood
                knows what is happening.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CinematicLink href="/volunteer?movement=albanian-revolution" variant="primary" size="md">
                  Sign up to volunteer
                </CinematicLink>
                <CinematicLink href="/become-organizer" variant="secondary" size="md">
                  Become an organizer
                </CinematicLink>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: 'Organizer', body: 'Lead a city. Coordinate marshals. Liaise with authorities.' },
                { title: 'Designer', body: 'Posters, social tiles, square signage.' },
                { title: 'Video editor', body: 'Short cuts for the diaspora feed.' },
                { title: 'Translator', body: 'Open letters and safety pages in EN/SQ/DE/IT.' },
                { title: 'Marshal', body: 'Day-of safety, crowd flow, water stations.' },
                { title: 'Social media', body: 'Boost local pages. Reply kindly. Avoid escalation.' },
                { title: 'Driver', body: 'Help regional buses arrive on time.' },
                { title: 'Legal observer', body: 'Document conduct, protect both sides.' },
              ].map((role) => (
                <Reveal key={role.title}>
                  <div className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="text-sm font-semibold text-white">{role.title}</div>
                    <p className="mt-1.5 text-xs leading-5 text-white/55">{role.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Safety & legality */}
      <section className="relative px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <SafetyPanel />
        </div>
      </section>

      {/* Final CTA banner */}
      <section className="relative py-24 sm:py-32 px-5 sm:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-flame-500/15 via-flame-500/5 to-transparent p-10 sm:p-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-flame-500/30 blur-3xl" />
          </div>
          <div className="relative flex flex-col items-start gap-8">
            <SectionLabel>Be part of it</SectionLabel>
            <h2 className="display-text text-4xl sm:text-5xl lg:text-6xl">
              The world is listening. <span className="italic text-flame-400">Add your city.</span>
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-white/70">
              Whether you have ten people or ten thousand, register your gathering and AlbaGo will
              help you organize, communicate, and stay safe — peacefully.
            </p>
            <div className="flex flex-wrap gap-3">
              <CinematicLink href="/events?category=civic" variant="primary" size="lg">
                Find a protest
              </CinematicLink>
              <CinematicLink href="/submit-event" variant="secondary" size="lg">
                Register a protest
              </CinematicLink>
              <CinematicLink href="/become-organizer" variant="ghost" size="lg">
                Volunteer
              </CinematicLink>
              <ShareButton />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function MovementCounter({ target }: { target: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const mv = useMotionValue(0)
  const display = useTransform(mv, (v) => Math.floor(v).toLocaleString())
  const [live, setLive] = useState(target)

  useEffect(() => {
    if (!inView) return
    const c = animate(mv, target, { duration: 2.5, ease: [0.22, 1, 0.36, 1] })
    return () => c.stop()
  }, [inView, mv, target])

  useEffect(() => {
    const id = setInterval(() => setLive((v) => v + Math.floor(Math.random() * 3) + 1), 1800)
    return () => clearInterval(id)
  }, [])

  if (target === 0) return null

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame-500/15 blur-3xl" />
      </div>
      <div ref={ref} className="mx-auto max-w-5xl px-5 sm:px-8 text-center">
        <Reveal>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-flame-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flame-500" />
            </span>
            <span className="text-white/80">Live · updating now</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="display-text text-3xl sm:text-4xl lg:text-5xl text-white/85">
            People worldwide standing peacefully, together
          </h2>
        </Reveal>
        <div className="relative mt-12">
          <motion.div className="font-display text-[clamp(72px,18vw,260px)] leading-none tracking-tight text-white">
            <motion.span>{display}</motion.span>
          </motion.div>
          <motion.div
            key={live}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-mono text-xs text-flame-400/80"
          >
            + {(live - target).toLocaleString()} since you opened this page
          </motion.div>
        </div>
        <p className="mt-16 mx-auto max-w-2xl text-white/55 text-base leading-relaxed">
          Every voice is counted. Every city matters. The movement grows when ordinary people
          decide that hope and lawfulness deserve a public square.
        </p>
      </div>
    </section>
  )
}

function ShareButton() {
  const [done, setDone] = useState(false)

  const onClick = async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    const title = 'Albanian Revolution — AlbaGo'
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      // user cancelled — silent
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex h-14 items-center justify-center gap-2 rounded-full px-8 text-base font-medium text-white/80 transition-all hover:bg-white/[0.05] hover:text-white"
    >
      <Share2 className="h-4 w-4" />
      {done ? 'Link copied' : 'Share the movement'}
      <Sparkles className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}
