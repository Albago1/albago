'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, X, ArrowUpRight } from 'lucide-react'
import { getLocationBySlug } from '@/lib/locations'
import { getEventTimezone, zonedWallClockToUtcMs } from '@/lib/timezone'

const DISMISS_KEY = 'albago:live-protests-banner:dismissed-until'
const DISMISS_FOR_MS = 1000 * 60 * 60 * 12 // 12 hours

type Protest = {
  id: string
  slug: string
  title: string
  date: string
  time: string | null
  location_slug: string
  country: string
  expected_attendees: number | null
}

type Totals = {
  count: number
  countries: number
  expected: number
}

type Props = {
  protests: Protest[]
  totals?: Totals
}

function titleizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatCountdown(
  date: string,
  time: string | null,
  timeZone: string,
): string {
  // Trim trailing seconds on "HH:MM:SS" so the wall-clock parses cleanly.
  // We anchor the countdown to the event's timezone — otherwise "18:00" was
  // being read as the viewer's local time, so the same DB row counted down
  // differently in Berlin vs New York.
  const raw = time ?? '18:00'
  const normalized = raw.length >= 5 ? raw.slice(0, 5) : raw
  const target = zonedWallClockToUtcMs(date, normalized, timeZone)
  const now = Date.now()
  const diff = target - now

  if (diff <= 0) return 'Live now'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days >= 1) return `in ${days}d`
  if (hours >= 1) return `in ${hours}h`
  const minutes = Math.max(1, Math.floor(diff / (1000 * 60)))
  return `in ${minutes}m`
}

function formatBigCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}

export default function LiveProtestsBanner({ protests, totals }: Props) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return
    const dismissUntil = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (dismissUntil > Date.now()) return
    const t = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(t)
  }, [])

  if (!mounted || protests.length === 0) return null

  const next = protests[0]
  const cityLabel =
    getLocationBySlug(next.location_slug)?.label ?? titleizeSlug(next.location_slug)
  const countdown = formatCountdown(
    next.date,
    next.time,
    getEventTimezone(next.location_slug, next.country),
  )

  // Prefer worldwide totals (fetched without limit) over the truncated list.
  const totalCount = totals?.count && totals.count > 0 ? totals.count : protests.length
  const totalCountries =
    totals?.countries && totals.countries > 0
      ? totals.countries
      : new Set(protests.map((p) => p.country).filter(Boolean)).size
  const totalExpected =
    totals?.expected && totals.expected > 0
      ? totals.expected
      : protests.reduce((sum, p) => sum + (p.expected_attendees ?? 0), 0)

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_FOR_MS))
    }
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0"
        >
          {/* Outer flame halo */}
          <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] bg-flame-500/20 blur-3xl" />

          <div className="relative overflow-hidden rounded-3xl border border-flame-500/40 bg-ink-950/95 shadow-[0_30px_70px_rgba(238,28,37,0.35)] backdrop-blur-xl">
            {/* Animated flame gradient backdrop */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-flame-500/30 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-flame-500/15 blur-3xl" />
              <div className="absolute inset-0 bg-grid opacity-30" />
            </div>

            {/* Dismiss */}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.12] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <Link
              href="/protests"
              className="group relative block p-5 focus:outline-none"
            >
              {/* LIVE pill */}
              <div className="flex items-center gap-2">
                <div className="relative flex h-6 items-center gap-1.5 rounded-full bg-flame-500 px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-glow-flame">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  Live
                </div>
                <span className="font-display text-[12px] italic text-flame-300">
                  Flamingo Revolution
                </span>
              </div>

              {/* Hero number — total protests */}
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-[56px] leading-none tracking-tight text-flame-500 drop-shadow-[0_0_30px_rgba(238,28,37,0.45)]">
                  {totalCount}
                </span>
                <span className="font-display text-[20px] italic leading-tight text-white/90">
                  {totalCount === 1 ? 'protest' : 'protests'}
                </span>
              </div>

              {/* Sub line — countries + (optional) expected */}
              <p className="mt-1 text-[12px] text-white/65">
                across{' '}
                <span className="font-semibold text-white">{totalCountries}</span>{' '}
                {totalCountries === 1 ? 'country' : 'countries'} worldwide
                {totalExpected > 0 && (
                  <>
                    {' '}·{' '}
                    <span className="font-semibold text-white">
                      {formatBigCount(totalExpected)}
                    </span>{' '}
                    expected
                  </>
                )}
              </p>

              {/* Next-protest strip */}
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-flame-500/20 bg-flame-500/[0.08] px-3 py-2">
                <Flame className="h-4 w-4 shrink-0 text-flame-400" />
                <div className="min-w-0 flex-1 text-[12px]">
                  <span className="text-white/55">Next: </span>
                  <span className="font-semibold text-white">{cityLabel}</span>
                  <span className="ml-1.5 text-flame-300">· {countdown}</span>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-flame-500 px-4 py-2.5 shadow-glow-flame transition group-hover:bg-flame-400 group-hover:-translate-y-0.5">
                <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-white">
                  Join the Revolution
                </span>
                <ArrowUpRight className="h-4 w-4 text-white" />
              </div>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
