'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, X, ArrowUpRight, Users } from 'lucide-react'
import { getLocationBySlug } from '@/lib/locations'

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

type Props = {
  protests: Protest[]
}

function titleizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatCountdown(date: string, time: string | null): string {
  const target = new Date(`${date}T${time ?? '18:00'}:00`).getTime()
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

export default function LiveProtestsBanner({ protests }: Props) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return
    const dismissUntil = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (dismissUntil > Date.now()) return
    // small entrance delay so it doesn't fight with hero load
    const t = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(t)
  }, [])

  if (!mounted || protests.length === 0) return null

  const next = protests[0]
  const cityLabel =
    getLocationBySlug(next.location_slug)?.label ?? titleizeSlug(next.location_slug)
  const countdown = formatCountdown(next.date, next.time)
  const totalExpected = protests.reduce(
    (sum, p) => sum + (p.expected_attendees ?? 0),
    0,
  )

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
          {/* Subtle flame halo */}
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-flame-500/15 blur-2xl" />

          <div className="relative overflow-hidden rounded-3xl border border-flame-500/30 bg-ink-950/90 p-4 shadow-[0_24px_60px_rgba(238,28,37,0.25)] backdrop-blur-xl">
            {/* Diagonal flame gradient backdrop */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-flame-500/15 via-transparent to-transparent" />

            {/* Dismiss */}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.1] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <Link
              href="/protests"
              className="relative block focus:outline-none"
            >
              {/* LIVE pill */}
              <div className="flex items-center gap-2">
                <div className="relative flex h-6 items-center gap-1.5 rounded-full bg-flame-500 px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  Live
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-300">
                  Hot right now
                </span>
              </div>

              {/* Headline */}
              <p className="mt-3 pr-6 font-display text-[20px] leading-tight text-white">
                <span className="italic text-flame-400">{protests.length}</span>{' '}
                {protests.length === 1 ? 'protest' : 'protests'} planned worldwide.
              </p>

              {/* Sub line */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/65">
                <span className="inline-flex items-center gap-1 text-flame-300">
                  <Flame className="h-3 w-3" />
                  Next:
                </span>
                <span className="truncate font-medium text-white/85">
                  {cityLabel}
                </span>
                <span className="text-white/40">·</span>
                <span className="text-flame-200">{countdown}</span>
                {totalExpected > 0 && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="inline-flex items-center gap-1 text-white/65">
                      <Users className="h-3 w-3" />
                      {totalExpected >= 1000
                        ? `${(totalExpected / 1000).toFixed(1)}k`
                        : totalExpected}{' '}
                      expected
                    </span>
                  </>
                )}
              </div>

              {/* CTA */}
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 transition group-hover:bg-white/[0.08]">
                <span className="text-[13px] font-semibold text-white">
                  Open the live protest map
                </span>
                <ArrowUpRight className="h-4 w-4 text-flame-300" />
              </div>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
