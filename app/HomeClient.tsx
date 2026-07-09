'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Flame,
  MapPin,
  Moon,
  Music2,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  UtensilsCrossed,
  Trophy,
  Palette,
  Calendar,
  Search,
  Megaphone,
  Sparkles,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import LiveProtestsBanner from '@/components/cinematic/LiveProtestsBanner'
import EventCard, { type PublicEvent } from '@/components/events/EventCard'
import { CATEGORY_GRADIENTS } from '@/components/events/categoryMeta'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { getLocationBySlug, locations } from '@/lib/locations'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'
import { useLocations } from '@/lib/useLocations'
import { createClient } from '@/lib/supabase/browser'
import { fetchSavedEventIds } from '@/lib/savedEvents'
import type { Place } from '@/types/place'

const categories = [
  { labelKey: 'category_nightlife', value: 'nightlife', icon: Moon },
  { labelKey: 'category_music', value: 'music', icon: Music2 },
  { labelKey: 'category_sports', value: 'sports', icon: Trophy },
  { labelKey: 'category_culture', value: 'culture', icon: Palette },
  { labelKey: 'category_food', value: 'food', icon: UtensilsCrossed },
  { labelKey: 'category_civic', value: 'civic', icon: Megaphone },
]

function getCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'
  const value = category.toLowerCase()

  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  if (value === 'civic') return 'bg-flame-500/20 text-flame-300'

  return 'bg-white/10 text-white/80'
}

// ISO 3166-1 alpha-2 country code → the big-city slug we snap to when a
// visitor lands from that country. Values match slugs that show up in
// our seeded event set / hardcoded locations list — adjust if the slug
// in the events table is different (e.g. 'tirane' vs 'tirana').
const BIG_CITY_BY_COUNTRY: Record<string, string> = {
  AL: 'tirana',
  XK: 'prishtina',
  RKS: 'prishtina',
  MK: 'prishtina', // North Macedonia → closest Albanian-speaking hub
  IT: 'roma',
  DE: 'berlin',
  AT: 'vienna',
  CH: 'zurich',
  GB: 'london',
  IE: 'dublin',
  FR: 'paris',
  ES: 'madrid',
  NL: 'amsterdam',
  BE: 'brussels',
  GR: 'athens',
  TR: 'istanbul',
  CZ: 'praha',
  PL: 'warsaw',
  SE: 'stockholm',
  NO: 'oslo',
  DK: 'copenhagen',
  FI: 'helsinki',
  US: 'new-york',
  CA: 'toronto',
  AU: 'sydney',
  AE: 'dubai',
}

// Remembered location — written after every successful detection or manual
// city pick so the next visit paints the right city instantly instead of
// flashing the Tirana default. Same localStorage pattern as `albago-theme`.
const LOCATION_STORAGE_KEY = 'albago-location'

type StoredLocation = { slug: string; label: string }

function readStoredLocation(): StoredLocation | null {
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredLocation>
    if (typeof parsed.slug === 'string' && parsed.slug && typeof parsed.label === 'string') {
      return { slug: parsed.slug, label: parsed.label }
    }
  } catch {
    // Corrupt JSON / storage unavailable (private mode) — behave as unset.
  }
  return null
}

function saveStoredLocation(slug: string, label: string) {
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ slug, label }))
  } catch {
    // Storage unavailable — the session still works, just isn't remembered.
  }
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildSearchUrl(
  path: '/events' | '/map',
  locationSlug: string,
  query: string
) {
  const params = new URLSearchParams()

  if (locationSlug) {
    params.set('location', locationSlug)
  }

  if (query.trim()) {
    params.set('q', query.trim())
  }

  return `${path}?${params.toString()}`
}

type SuggestionEvent = { id: string; slug: string; title: string; category: string; location_slug: string }

/**
 * Odometer-style stat: counts up from the current value to the target when
 * the number scrolls into view (and re-animates when live data changes it).
 */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let raf = 0
    const from = display
    const duration = 800
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      // easeOutCubic so the last digits settle gently
      setDisplay(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // `display` is intentionally only read as the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, visible])

  return (
    <span ref={ref} className="tabular-nums">
      {display}
    </span>
  )
}

export default function HomeClient() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const locationOptions = useLocations()
  const [locationInput, setLocationInput] = useState('Tirana')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [activeLocationSlug, setActiveLocationSlug] = useState('tirana')
  const [isLocating, setIsLocating] = useState(false)
  const [featuredEvents, setFeaturedEvents] = useState<PublicEvent[]>([])
  const [upcomingProtests, setUpcomingProtests] = useState<
    Array<PublicEvent & { expected_attendees: number | null }>
  >([])
  const [protestTotals, setProtestTotals] = useState<{
    count: number
    countries: number
    expected: number
  }>({ count: 0, countries: 0, expected: 0 })
  const [allPlaces, setAllPlaces] = useState<Place[]>([])
  // Lightweight rows used only for the live "Across the platform" counts.
  // Same shape /protests uses — we mirror its isEventActive + realtime flow
  // so an event silently drops out of the tally the moment it expires or
  // the admin unpublishes it.
  const [globalEventRows, setGlobalEventRows] = useState<Array<{
    id: string
    location_slug: string
    country: string
    place_id: string | null
    category: string | null
    date: string
    time: string | null
    end_time: string | null
    recurrence: string | null
    recurrence_until: string | null
    recurrence_days_of_week: number[] | null
    recurrence_exceptions: string[] | null
    status: string
  }>>([])
  // Bumped every 60s so isEventActive re-runs against the current wall clock —
  // handles the end_time cutoff and the midnight rollover without needing a DB
  // event to fire.
  const [nowTick, setNowTick] = useState(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchSuggestionEvents, setSearchSuggestionEvents] = useState<SuggestionEvent[]>([])
  const [isAuth, setIsAuth] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const prevLocationLabel = useRef<string>('')
  const locationInputValue = useRef<string>('Tirana')
  const locationDropdownRef = useRef<HTMLDivElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const locationOptionsRef = useRef(locationOptions)

  useEffect(() => {
    locationOptionsRef.current = locationOptions
  }, [locationOptions])

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

  // Precise GPS detection: nearest known city within 150 km, else reverse
  // geocode. `silent: true` skips the spinner/dropdown side effects — used on
  // page load when geolocation is already granted, so the city refreshes
  // automatically on every visit without re-prompting the user.
  const detectPreciseLocation = useCallback((opts: { silent?: boolean } = {}) => {
    if (!navigator.geolocation) return
    const { silent = false } = opts
    if (!silent) setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        const candidates = locationOptionsRef.current.length > 0
          ? locationOptionsRef.current
          : locations
        let nearest = candidates[0]
        let nearestKm = Infinity
        for (const loc of candidates) {
          const km = distanceKm(latitude, longitude, loc.center[1], loc.center[0])
          if (km < nearestKm) { nearestKm = km; nearest = loc }
        }

        if (nearestKm <= 150) {
          setLocationInput(nearest.label)
          setActiveLocationSlug(nearest.slug)
          saveStoredLocation(nearest.slug, nearest.label)
          setIsLocating(false)
          if (!silent) setIsLocationOpen(false)
          return
        }

        // User is far from all known cities — try reverse geocoding
        let cityLabel = 'Your current location'
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 4000)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'User-Agent': 'AlbaGo/1.0' }, signal: controller.signal }
          )
          clearTimeout(timer)
          if (res.ok) {
            const data = await res.json()
            const city = data.address?.city || data.address?.town || data.address?.village
            if (city) cityLabel = city
          }
        } catch {
          // silent — fallback label already set
        }

        setLocationInput(cityLabel)
        if (cityLabel === 'Your current location') {
          setActiveLocationSlug('current-location')
        } else {
          const slug = cityLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
          setActiveLocationSlug(slug)
          saveStoredLocation(slug, cityLabel)
        }
        setIsLocating(false)
        if (!silent) setIsLocationOpen(false)
      },
      () => {
        setIsLocating(false)
        if (!silent) setIsLocationOpen(false)
      },
      // High accuracy for a precise fix; silent refreshes accept a cached fix
      // up to 2 minutes old so repeat visits resolve instantly.
      { timeout: 8000, enableHighAccuracy: true, maximumAge: silent ? 120_000 : 0 }
    )
  }, [])

  // Resolve the visitor's location on first paint, in precision order:
  // 1. Restore the last remembered city instantly (no Tirana flash).
  // 2. If geolocation was already granted once, silently re-detect a precise
  //    position — runs on every visit/refresh, never re-prompts.
  // 3. Otherwise fall back to the coarse country → big-city snap (Vercel IP
  //    geo) — someone in Munich gets Berlin, not a random suburb — and only
  //    when nothing was remembered.
  const didAutoSnap = useRef(false)
  useEffect(() => {
    if (didAutoSnap.current) return
    if (activeLocationSlug !== 'tirana') {
      didAutoSnap.current = true
      return
    }
    didAutoSnap.current = true
    let cancelled = false

    const stored = readStoredLocation()
    if (stored) {
      setLocationInput(stored.label)
      setActiveLocationSlug(stored.slug)
    }

    ;(async () => {
      try {
        if (navigator.geolocation && navigator.permissions) {
          const perm = await navigator.permissions.query({ name: 'geolocation' })
          if (cancelled) return
          if (perm.state === 'granted') {
            detectPreciseLocation({ silent: true })
            return
          }
        }
      } catch {
        // Permissions API unsupported (older Safari) — fall through.
      }

      if (stored || cancelled) return

      try {
        const res = await fetch('/api/geo', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          available: boolean
          country: string | null
        }
        if (cancelled || !data.available || !data.country) return

        const code = data.country.toUpperCase()
        const mapped = BIG_CITY_BY_COUNTRY[code]
        if (!mapped) return

        const candidates = locationOptionsRef.current.length > 0
          ? locationOptionsRef.current
          : locations
        const found = candidates.find((l) => l.slug === mapped)
        if (found) {
          setLocationInput(found.label)
          setActiveLocationSlug(found.slug)
        }
      } catch {
        // Silent fallback to the hardcoded default.
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function fetchFeatured() {
      const today = new Date().toISOString().slice(0, 10)
      const activeFilter = activeEventsOrFilter(today)
      const [
        placesRes,
        eventsRes,
        globalEventsRes,
        protestsRes,
        protestsTotalsRes,
      ] = await Promise.all([
        supabase.from('places').select('*').eq('location_slug', activeLocationSlug),
        supabase
          .from('events')
          .select('*')
          .eq('status', 'published')
          .eq('location_slug', activeLocationSlug)
          .or(activeFilter)
          .order('highlight', { ascending: false })
          .order('date', { ascending: true })
          .limit(12),
        supabase
          .from('events')
          .select(
            'id, location_slug, country, place_id, category, date, time, end_time, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions, status',
          )
          .eq('status', 'published')
          .or(activeFilter),
        supabase
          .from('events')
          .select('*')
          .eq('status', 'published')
          .eq('is_civic', true)
          .or(activeFilter)
          .order('date', { ascending: true })
          .limit(12),
        supabase
          .from('events')
          .select(
            'country, expected_attendees, date, end_time, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
          )
          .eq('status', 'published')
          .eq('is_civic', true)
          .or(activeFilter),
      ])

      if (placesRes.data) {
        const mapped: Place[] = placesRes.data.map((p) => {
          const loc = getLocationBySlug(p.location_slug)
          return {
            id: p.id,
            slug: p.slug,
            name: p.name,
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            description: p.description,
            options: Array.isArray(p.options) ? p.options : [],
            imageUrl: p.image_url ?? undefined,
            city: loc ? `${loc.city ?? loc.label}, ${loc.country}` : p.country,
            address: p.address ?? undefined,
            websiteUrl: p.website_url ?? undefined,
            verified: p.verified ?? false,
            status: p.status ?? undefined,
          }
        })
        setAllPlaces(mapped)
      }

      if (eventsRes.data) {
        // Keep the full rows — EventCard needs banner_url, recurrence, etc.
        const cityEvents = eventsRes.data.filter(isEventActive)
        if (cityEvents.length > 0) {
          setFeaturedEvents(cityEvents.slice(0, 6))
        } else {
          // No active events in the selected city — fall back to worldwide
          // picks so the section never renders empty.
          const worldwideRes = await supabase
            .from('events')
            .select('*')
            .eq('status', 'published')
            .or(activeFilter)
            .order('highlight', { ascending: false })
            .order('date', { ascending: true })
            .limit(12)
          setFeaturedEvents(
            (worldwideRes.data ?? []).filter(isEventActive).slice(0, 6),
          )
        }
      }

      if (protestsRes.data) {
        const activeProtests = (protestsRes.data as Array<
          PublicEvent & {
            expected_attendees: number | null
            end_time: string | null
            recurrence: string | null
            recurrence_until: string | null
            recurrence_days_of_week: number[] | null
            recurrence_exceptions: string[] | null
          }
        >).filter(isEventActive).slice(0, 6)
        setUpcomingProtests(activeProtests)
      }

      if (protestsTotalsRes.data) {
        const rows = (protestsTotalsRes.data as Array<{
          country: string | null
          expected_attendees: number | null
          date: string
          end_time: string | null
          recurrence: string | null
          recurrence_until: string | null
          recurrence_days_of_week: number[] | null
          recurrence_exceptions: string[] | null
        }>).filter(isEventActive)
        const countries = new Set(
          rows.map((r) => (r.country ?? '').trim().toLowerCase()).filter(Boolean),
        ).size
        const expected = rows.reduce(
          (sum, r) => sum + (r.expected_attendees ?? 0),
          0,
        )
        setProtestTotals({ count: rows.length, countries, expected })
      }

      if (globalEventsRes.data) {
        setGlobalEventRows(globalEventsRes.data)
      }
    }

    fetchFeatured()
  }, [activeLocationSlug, supabase])

  // Live-tally subscription. Same shape as /protests but unfiltered, so any
  // publish / unpublish / cancel / delete on the events table flows straight
  // into globalEventRows and the counts re-derive.
  useEffect(() => {
    const channel = supabase
      .channel('home-events-stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          const newRow = payload.new as Record<string, unknown> | null
          const oldRow = payload.old as { id?: string } | null

          if (payload.eventType === 'DELETE') {
            if (oldRow?.id) {
              setGlobalEventRows((prev) => prev.filter((e) => e.id !== oldRow.id))
            }
            return
          }
          if (!newRow) return

          const isPublished = newRow.status === 'published'
          const stillActive =
            isPublished &&
            isEventActive({
              date: newRow.date as string,
              time: (newRow.time as string | null) ?? null,
              end_time: (newRow.end_time as string | null) ?? null,
              recurrence: (newRow.recurrence as string | null) ?? null,
              recurrence_until: (newRow.recurrence_until as string | null) ?? null,
              recurrence_days_of_week:
                (newRow.recurrence_days_of_week as number[] | null) ?? null,
              recurrence_exceptions:
                (newRow.recurrence_exceptions as string[] | null) ?? null,
            })

          setGlobalEventRows((prev) => {
            const without = prev.filter((e) => e.id !== (newRow.id as string))
            if (!stillActive) return without
            return [
              ...without,
              {
                id: newRow.id as string,
                location_slug: newRow.location_slug as string,
                country: newRow.country as string,
                place_id: (newRow.place_id as string | null) ?? null,
                category: (newRow.category as string | null) ?? null,
                date: newRow.date as string,
                time: (newRow.time as string | null) ?? null,
                end_time: (newRow.end_time as string | null) ?? null,
                recurrence: (newRow.recurrence as string | null) ?? null,
                recurrence_until: (newRow.recurrence_until as string | null) ?? null,
                recurrence_days_of_week:
                  (newRow.recurrence_days_of_week as number[] | null) ?? null,
                recurrence_exceptions:
                  (newRow.recurrence_exceptions as string[] | null) ?? null,
                status: newRow.status as string,
              },
            ]
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Wall-clock tick so end_time and midnight rollover invalidate counts even
  // when no DB write has happened.
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestionEvents([])
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('events')
        .select('id, slug, title, category, location_slug')
        .eq('status', 'published')
        .ilike('title', `%${searchQuery.trim()}%`)
        .limit(4)
      setSearchSuggestionEvents(data ?? [])
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery, supabase])

  useEffect(() => {
    locationInputValue.current = locationInput
  }, [locationInput])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setIsLocationOpen(false)
        const typed = locationInputValue.current.trim()
        if (typed === '') {
          setLocationInput(prevLocationLabel.current)
          return
        }
        const exact = locationOptionsRef.current.find(
          (l) => l.label.toLowerCase() === typed.toLowerCase()
        )
        if (exact) {
          setLocationInput(exact.label)
          setActiveLocationSlug(exact.slug)
          saveStoredLocation(exact.slug, exact.label)
        } else {
          setLocationInput(prevLocationLabel.current)
        }
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDetectLocation = () => detectPreciseLocation()

  const matchingLocations = locationOptions.filter((location) => {
  const search = locationInput.toLowerCase()

  return (
    location.label.toLowerCase().includes(search) ||
    location.country.toLowerCase().includes(search) ||
    location.region?.toLowerCase().includes(search)
  )
})
  const resolvedLocation = getLocationBySlug(activeLocationSlug)

  // Active-event derived counts. nowTick is in the dep list on purpose so the
  // tally refreshes every minute against the wall clock; ESLint doesn't see
  // it as "used" inside the filter callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeGlobalEvents = useMemo(() => globalEventRows.filter(isEventActive), [globalEventRows, nowTick])
  const totalEventsCount = activeGlobalEvents.length
  const totalCitiesCount = useMemo(
    () => new Set(activeGlobalEvents.map((e) => e.location_slug)).size,
    [activeGlobalEvents],
  )
  // Distinct venues with at least one live event. Civic/online events without a
  // place_id don't contribute — "venues" should mean actual venues.
  const totalPlacesCount = useMemo(
    () =>
      new Set(
        activeGlobalEvents
          .map((e) => e.place_id)
          .filter((id): id is string => !!id),
      ).size,
    [activeGlobalEvents],
  )

  // Live events per category — drives the "N live" badges on the showcase
  // tiles and re-derives on every realtime change / wall-clock tick.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of activeGlobalEvents) {
      const c = (e.category ?? '').toLowerCase()
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    return counts
  }, [activeGlobalEvents])

  // Venues for the active city, verified first. No popularity signal yet, so
  // verification + name is the most honest "trending" we can offer.
  const trendingPlaces = useMemo(
    () =>
      [...allPlaces]
        .sort((a, b) => {
          if (Boolean(a.verified) !== Boolean(b.verified)) return a.verified ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .slice(0, 8),
    [allPlaces],
  )

  // getLocationBySlug() falls back to Tirana for unknown slugs, so resolve
  // against the dynamic options first, then titleize as a last resort.
  const cityLabelFor = (slug: string) => {
    const dynamicMatch = locationOptions.find((o) => o.slug === slug)
    if (dynamicMatch) return dynamicMatch.label
    const staticMatch = locations.find((l) => l.slug === slug)
    if (staticMatch) return staticMatch.label
    return slug
      .split('-')
      .map((part) => (part[0]?.toUpperCase() ?? '') + part.slice(1))
      .join(' ')
  }

  const searchQ = searchQuery.trim().toLowerCase()
  const isTyping = searchQ.length > 0

  // Suggestions shown while typing — events from DB, filtered cats, filtered locs
  const suggestEvents = isTyping ? searchSuggestionEvents : []
  const suggestCats = isTyping
    ? categories.filter((c) => c.value.includes(searchQ))
    : categories
  const suggestLocs = isTyping
    ? locationOptions.filter(
        (l) =>
          l.label.toLowerCase().includes(searchQ) ||
          l.country.toLowerCase().includes(searchQ)
      ).slice(0, 3)
    : locationOptions.slice(0, 5)
  // Default (empty focus) events — use already-loaded featured events
  const defaultEvents = featuredEvents.slice(0, 3)
  const hasAnySuggestion =
    isTyping
      ? suggestEvents.length > 0 || suggestCats.length > 0 || suggestLocs.length > 0
      : true // default state always has categories

  // Hero poster wall — the platform's own artwork (event banners, falling
  // back to each event's cached AI poster; misses render as dark frames)
  // drifting behind the headline. Purely decorative.
  const posterWall = useMemo(() => {
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL
    const seen = new Set<string>()
    const withBanner: string[] = []
    const withoutBanner: string[] = []
    for (const ev of [...featuredEvents, ...upcomingProtests]) {
      const slug = (ev as { slug?: string }).slug
      if (!slug || seen.has(slug)) continue
      seen.add(slug)
      const banner = (ev as { banner_url?: string | null }).banner_url
      if (banner) withBanner.push(banner)
      else withoutBanner.push(`${supa}/storage/v1/object/public/ai-posters/${slug}.jpg`)
    }
    return [...withBanner, ...withoutBanner].slice(0, 20)
  }, [featuredEvents, upcomingProtests])

  const posterColumns = useMemo(() => {
    if (posterWall.length < 4) return []
    const COLS = 5
    const cols: string[][] = Array.from({ length: COLS }, () => [])
    posterWall.forEach((src, i) => cols[i % COLS].push(src))
    // Each column repeats its tiles to at least 5 so the drift loop never
    // shows a gap, regardless of how many events are live.
    return cols
      .filter((col) => col.length > 0)
      .map((col) =>
        Array.from({ length: Math.max(col.length, 5) }, (_, k) => col[k % col.length]),
      )
  }, [posterWall])

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <LiveProtestsBanner protests={upcomingProtests} totals={protestTotals} />

      <section className="relative overflow-hidden px-4 pb-20 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {posterColumns.length > 0 && (
            <div aria-hidden className="absolute -inset-x-16 -inset-y-40 rotate-[-4deg]">
              <div className="flex h-full justify-center gap-4 opacity-30 sm:gap-5">
                {posterColumns.map((col, i) => (
                  <div
                    key={i}
                    className={`w-[clamp(150px,19vw,250px)] shrink-0 ${i % 2 ? 'mt-28' : ''}`}
                  >
                    <div
                      className={i % 2 ? 'poster-drift-down' : 'poster-drift-up'}
                      style={{ animationDuration: `${75 + i * 13}s` }}
                    >
                      {[0, 1].map((copy) => (
                        <div key={copy} className="flex flex-col gap-4 pb-4 sm:gap-5 sm:pb-5">
                          {col.map((src, j) => (
                            <div
                              key={`${copy}-${j}`}
                              className="aspect-[3/4] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-ink-900"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  // Missing artwork stays a quiet dark frame.
                                  e.currentTarget.style.visibility = 'hidden'
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="hero-wall-vignette-b absolute inset-0" />
          <div className="hero-wall-vignette-r absolute inset-0" />
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-flame-500/20 blur-3xl" />
          <div className="absolute left-[58%] top-32 h-[26rem] w-[26rem] rounded-full bg-flame-500/12 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-flame-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flame-500" />
            </span>
            <span className="text-white/80">Events · Nightlife · Civic Movements</span>
          </div>

          <h1 className="display-text mt-10 max-w-5xl text-5xl sm:text-7xl lg:text-[96px] xl:text-[112px] leading-[0.92] tracking-tight">
            {t('hero_title')}
          </h1>

          <p className="mt-8 max-w-3xl text-lg leading-8 text-white/55 sm:text-2xl">
            {t('hero_subtitle')}
          </p>

          <div className="mt-10 w-full max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
            <div className="relative" ref={searchContainerRef}>
              <div className="flex h-14 items-center gap-3 rounded-2xl bg-ink-900 px-4">
                <Search className="h-5 w-5 text-white/35" />

                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setIsSearchOpen(true)
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      setIsSearchOpen(false)
                      router.push(buildSearchUrl('/events', activeLocationSlug, searchQuery))
                    }
                  }}
                  placeholder={t('home_search_placeholder')}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/35"
                />
              </div>

              {isSearchOpen && hasAnySuggestion && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-[420px] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-ink-900 text-left shadow-2xl">

                  {/* ── Categories ── */}
                  {suggestCats.length > 0 && (
                    <>
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {isTyping ? t('home_suggest_category') : t('home_suggest_explore')}
                      </p>
                      {suggestCats.map((cat) => {
                        const Icon = cat.icon
                        return (
                          <Link
                            key={cat.value}
                            href={`/events?location=${activeLocationSlug}&category=${cat.value}`}
                            onClick={() => setIsSearchOpen(false)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.06]"
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${getCategoryTone(cat.value)}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="capitalize font-medium text-white">{cat.value}</span>
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-white/30">{t('home_suggest_category')}</span>
                          </Link>
                        )
                      })}
                    </>
                  )}

                  {/* ── Events (default: featured; typing: DB ilike results) ── */}
                  {(isTyping ? suggestEvents : defaultEvents).length > 0 && (
                    <>
                      <div className="mx-4 border-t border-white/[0.06]" />
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {isTyping ? t('events') : t('home_suggest_upcoming')}
                      </p>
                      {(isTyping ? suggestEvents : defaultEvents).map((ev) => (
                        <Link
                          key={ev.id}
                          href={`/events/${ev.slug}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.06]"
                        >
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getCategoryTone(ev.category)}`}>
                            {ev.category}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium text-white">{ev.title}</span>
                          {isTyping && 'location_slug' in ev && (
                            <span className="shrink-0 text-[10px] text-white/30">
                              {getLocationBySlug((ev as SuggestionEvent).location_slug).label}
                            </span>
                          )}
                          {!isTyping && (
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-white/30">{t('home_suggest_event')}</span>
                          )}
                        </Link>
                      ))}
                    </>
                  )}

                  {/* ── Cities ── */}
                  {suggestLocs.length > 0 && (
                    <>
                      <div className="mx-4 border-t border-white/[0.06]" />
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {isTyping ? t('cities') : t('home_suggest_browse_city')}
                      </p>
                      {suggestLocs.map((loc) => (
                        <Link
                          key={loc.slug}
                          href={`/events?location=${loc.slug}`}
                          onClick={() => {
                            setLocationInput(loc.label)
                            setActiveLocationSlug(loc.slug)
                            saveStoredLocation(loc.slug, loc.label)
                            setIsSearchOpen(false)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.06]"
                        >
                          <MapPin className="h-4 w-4 shrink-0 text-white/35" />
                          <span className="font-medium text-white">{loc.label}</span>
                          <span className="ml-auto text-[10px] text-white/30">{loc.country}</span>
                        </Link>
                      ))}
                    </>
                  )}

                </div>
              )}
            </div>

            <div className="relative" ref={locationDropdownRef}>
              <div className="flex h-14 items-center gap-3 rounded-2xl bg-ink-900 px-4">
                <MapPin className="h-5 w-5 text-white/35" />

                <input
                  value={locationInput}
                  onFocus={() => {
                    prevLocationLabel.current = locationInput
                    setLocationInput('')
                    setIsLocationOpen(true)
                  }}
                  onChange={(event) => {
                    setLocationInput(event.target.value)
                    setIsLocationOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      const typed = locationInput.trim()
                      const exact = locationOptions.find(
                        (l) => l.label.toLowerCase() === typed.toLowerCase()
                      )
                      if (exact) {
                        setLocationInput(exact.label)
                        setActiveLocationSlug(exact.slug)
                        saveStoredLocation(exact.slug, exact.label)
                      } else {
                        setLocationInput(prevLocationLabel.current)
                      }
                      setIsLocationOpen(false)
                    }
                  }}
                  placeholder={t('home_location_placeholder')}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
                />
              </div>

              {isLocationOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-3xl border border-white/10 bg-ink-900 text-left shadow-2xl">
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isLocating}
                    className="flex w-full items-center gap-3 px-4 py-4 text-sm text-white/80 transition hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    <MapPin className="h-5 w-5 text-flame-400" />
                    <span>{isLocating ? t('home_detecting') : t('home_use_my_location')}</span>
                  </button>

                  <div className="border-t border-white/10" />

                  {matchingLocations.map((location) => (
                    <button
                      key={location.slug}
                      type="button"
                      onClick={() => {
                        setLocationInput(location.label)
                        setActiveLocationSlug(location.slug)
                        saveStoredLocation(location.slug, location.label)
                        setIsLocationOpen(false)
                      }}
                      className="flex w-full items-start gap-3 px-4 py-4 text-sm transition hover:bg-white/[0.06]"
                    >
                      <MapPin className="mt-0.5 h-5 w-5 text-white/35" />

                      <span>
                        <span className="block font-semibold text-white">
                          {location.label}
                        </span>
                        <span className="block text-xs text-white/45">
                          {location.region ? `${location.region}, ` : ''}
                          {location.country}
                        </span>
                      </span>
                    </button>
                  ))}

                  {matchingLocations.length === 0 && (
                    <div className="px-4 py-4 text-sm text-white/45">
                      {t('home_no_saved_location')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              href={buildSearchUrl('/events', activeLocationSlug, searchQuery)}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-flame-500 px-6 text-sm font-semibold text-white transition hover:bg-flame-400"
            >
              <Search className="h-5 w-5" />
              {t('home_search_button')}
            </Link>
          </div>

          <p className="mt-3 px-2 text-left text-sm text-white/45">
            {t('home_search_hint')}
          </p>
        </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            <Link
              href={`/events?location=${activeLocationSlug}&time=tonight`}
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
            >
              <Flame className="h-4 w-4" />
              {t('tonight')}
            </Link>

            {categories.map((category) => {
              const Icon = category.icon

              return (
                <Link
                  key={category.value}
                  href={`/events?location=${activeLocationSlug}&category=${category.value}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white hover:-translate-y-0.5"
                >
                  <Icon className="h-4 w-4" />
                  {t(category.labelKey)}
                </Link>
              )
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-sm text-white/45">{t('home_quick_locations')}</span>

            {locationOptions.slice(0, 6).map((location) => (
              <button
                key={location.slug}
                type="button"
                onClick={() => {
                  setLocationInput(location.label)
                  setActiveLocationSlug(location.slug)
                  saveStoredLocation(location.slug, location.label)
                }}
                className={[
                  'rounded-full border px-4 py-2 text-sm transition',
                  resolvedLocation.slug === location.slug
                    ? 'border-flame-500/40 bg-flame-500/15 text-flame-300'
                    : 'border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.06] hover:text-white',
                ].join(' ')}
              >
                {location.label}
              </button>
            ))}

            {locationOptions.length > 6 && (
              <Link
                href="/events"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              >
                +{locationOptions.length - 6} {t('home_more')}
              </Link>
            )}

            <Link
              href={buildSearchUrl('/map', activeLocationSlug, searchQuery)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
            >
              <MapPin className="h-3.5 w-3.5" />
              {t('open_map')}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02] py-10">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
            {t('home_across_platform')}
          </p>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="text-5xl font-bold text-flame-500">
                <CountUp value={totalPlacesCount} />
              </div>
              <div className="mt-2 text-xl text-white/65">{t('venues')}</div>
            </div>

            <div className="text-center">
              <div className="text-5xl font-bold text-flame-500">
                <CountUp value={totalEventsCount} />
              </div>
              <div className="mt-2 text-xl text-white/65">{t('events')}</div>
            </div>

            <div className="text-center">
              <div className="text-5xl font-bold text-flame-500">
                <CountUp value={totalCitiesCount} />
              </div>
              <div className="mt-2 text-xl text-white/65">{t('cities')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Calendar className="h-5 w-5 text-flame-400" />
              </div>

              <div>
                <h2 className="display-text text-3xl text-white sm:text-5xl">
                  {t('home_featured_events')}
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  {t('home_featured_sub')}
                </p>
              </div>
            </div>

            <Link
              href={buildSearchUrl('/events', activeLocationSlug, searchQuery)}
              className="hidden items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white sm:inline-flex"
            >
              {t('view_all')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featuredEvents.map((event) => {
              const place = allPlaces.find((item) => item.id === event.place_id)

              return (
                <motion.div
                  key={event.id}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="h-full"
                >
                  <EventCard
                    event={event}
                    venueName={place?.name ?? null}
                    cityLabel={cityLabelFor(event.location_slug)}
                    isAuthenticated={isAuth}
                    initialSaved={savedIds.has(event.id)}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Browse by category (Fever-style showcase tiles) ── */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Sparkles className="h-5 w-5 text-flame-400" />
            </div>

            <div>
              <h2 className="display-text text-3xl text-white sm:text-5xl">
                {t('home_browse_category')}
              </h2>
              <p className="mt-2 text-sm text-white/55">
                {t('home_browse_category_sub')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {categories.map((category) => {
              const Icon = category.icon
              const liveCount = categoryCounts.get(category.value) ?? 0
              const gradient =
                CATEGORY_GRADIENTS[category.value] ?? 'from-white/10 via-ink-900 to-ink-950'

              return (
                <Link
                  key={category.value}
                  href={`/events?location=${activeLocationSlug}&category=${category.value}`}
                  className="on-media group relative block aspect-[16/10] overflow-hidden rounded-3xl border border-white/10 transition hover:border-white/25 sm:aspect-[16/9]"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradient} transition duration-500 ease-out group-hover:scale-105`}
                  />
                  <div className="absolute inset-0 bg-grid opacity-25" />
                  <Icon
                    aria-hidden
                    className="pointer-events-none absolute -bottom-5 -right-4 h-24 w-24 rotate-12 text-white/[0.07] transition duration-500 group-hover:scale-110 group-hover:text-white/[0.12]"
                  />

                  <div className="absolute inset-x-4 top-4 flex items-start justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-ink-950/50 backdrop-blur-md">
                      <Icon className="h-4 w-4 text-white/85" />
                    </span>
                    {liveCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-950/60 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-md">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-flame-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flame-500" />
                        </span>
                        {liveCount} {t('home_live')}
                      </span>
                    )}
                  </div>

                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
                    <span className="text-lg font-semibold text-white sm:text-xl">
                      {t(category.labelKey)}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-white/40 opacity-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white group-hover:opacity-100" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Trending venues rail ── */}
      {trendingPlaces.length > 0 && (
        <section className="px-4 pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <MapPin className="h-5 w-5 text-flame-400" />
                </div>

                <div>
                  <h2 className="display-text text-3xl text-white sm:text-5xl">
                    {t('home_venues_in')} {resolvedLocation.label}
                  </h2>
                  <p className="mt-2 text-sm text-white/55">
                    {t('home_venues_sub')}
                  </p>
                </div>
              </div>

              <Link
                href={`/map?location=${activeLocationSlug}`}
                className="hidden items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white sm:inline-flex"
              >
                {t('open_map')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-4">
                {trendingPlaces.map((place) => (
                  <Link
                    key={place.id}
                    href={`/places/${place.slug}`}
                    className="group w-60 shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md transition hover:border-flame-500/30 hover:bg-white/[0.05]"
                  >
                    <div className="on-media relative aspect-[4/3] overflow-hidden">
                      {place.imageUrl ? (
                        <Image
                          src={place.imageUrl}
                          alt={place.name}
                          fill
                          sizes="240px"
                          unoptimized={!place.imageUrl.includes('.supabase.co')}
                          className="object-cover transition duration-500 ease-out group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${
                            CATEGORY_GRADIENTS[place.category?.toLowerCase() ?? ''] ??
                            'from-white/10 via-ink-900 to-ink-950'
                          } transition duration-500 ease-out group-hover:scale-105`}
                        >
                          <MapPin className="h-8 w-8 text-white/20" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
                      {place.verified && (
                        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink-950/60 backdrop-blur-md">
                          <BadgeCheck className="h-4 w-4 text-flame-400" />
                        </span>
                      )}
                      {place.category && (
                        <span
                          className={`absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize backdrop-blur-md ${getCategoryTone(place.category)}`}
                        >
                          {place.category}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="truncate font-semibold text-white">{place.name}</p>
                      <p className="mt-0.5 truncate text-xs text-white/45">{place.city}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-flame-500/30 bg-flame-500/10">
                <Flame className="h-5 w-5 text-flame-400" />
              </div>

              <div>
                <h2 className="display-text text-3xl text-white sm:text-5xl">
                  {t('home_upcoming_protests')}
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  {t('home_upcoming_protests_sub')}
                </p>
              </div>
            </div>

            <Link
              href="/protests"
              className="hidden items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white sm:inline-flex"
            >
              {t('view_all')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {upcomingProtests.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-md">
              <p className="text-base font-semibold text-white">
                {t('home_no_protests')}
              </p>
              <p className="mt-2 text-sm text-white/55">
                {t('home_no_protests_hint')}
              </p>
              <Link
                href="/submit-event"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400"
              >
                <Flame className="h-4 w-4" />
                {t('home_post_one')}
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {upcomingProtests.map((protest) => {
                const place = allPlaces.find((item) => item.id === protest.place_id)

                return (
                  <motion.div
                    key={protest.id}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    className="h-full"
                  >
                    <EventCard
                      event={protest}
                      venueName={place?.name ?? null}
                      cityLabel={cityLabelFor(protest.location_slug)}
                      isAuthenticated={isAuth}
                      initialSaved={savedIds.has(protest.id)}
                    />
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/events/albanian-revolution"
            className="group relative block overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-flame-500/15 via-flame-500/5 to-transparent p-8 sm:p-12 transition hover:border-flame-500/40"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-1/3 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-flame-500/20 blur-3xl" />
            </div>
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/75">
                  <span className="h-1.5 w-1.5 rounded-full bg-flame-500" />
                  {t('protests_spotlight_label')}
                </div>
                <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {t('home_movement_title')}
                </h2>
                <p className="mt-3 text-base leading-7 text-white/65">
                  {t('home_movement_body')}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition group-hover:bg-white/90">
                {t('home_enter_campaign')}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-10 h-96 w-96 -translate-x-1/2 rounded-full bg-flame-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="display-text text-5xl sm:text-6xl lg:text-7xl text-white">
            {t('submit_event')}
          </h2>

          <p className="mt-8 text-xl text-white/60">
            {t('submit_event_subtitle')}
          </p>

          <div className="mt-12">
            <Link
              href="/submit-event"
              className="inline-flex items-center gap-3 rounded-full bg-flame-500 px-10 py-5 text-lg font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
            >
              {t('submit_event')}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}