'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Clock3,
  MapPin,
  Megaphone,
  MessageCircle,
  Repeat,
  Send,
  Users,
} from 'lucide-react'
import {
  isRecurring,
  nextOccurrence,
  recurrenceLabel,
} from '@/lib/recurrence'
import { formatEventTimeLabel } from '@/lib/dateFilters'

export type ProtestEvent = {
  id: string
  slug: string
  title: string
  description: string
  date: string
  time: string
  category: string
  price: string | null
  highlight: boolean
  placeId: string | null
  placeName: string | null
  lat: number | null
  lng: number | null
  address: string | null
  locationSlug: string
  country: string
  region: string | null
  eventType: string | null
  isCivic: boolean
  organizerContact: string | null
  telegramLink: string | null
  whatsappLink: string | null
  safetyNotes: string | null
  expectedAttendees: number | null
  recurrence?: string | null
  recurrenceUntil?: string | null
  recurrenceDaysOfWeek?: number[] | null
  recurrenceExceptions?: string[] | null
}

/** Shim that lets the recurrence helpers accept a ProtestEvent (camelCase). */
function asRecurring(ev: ProtestEvent) {
  return {
    date: ev.date,
    time: ev.time,
    recurrence: ev.recurrence ?? null,
    recurrence_until: ev.recurrenceUntil ?? null,
    recurrence_days_of_week: ev.recurrenceDaysOfWeek ?? null,
    recurrence_exceptions: ev.recurrenceExceptions ?? null,
  }
}

export function formatProtestNumber(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return value.toLocaleString()
}

export function formatProtestDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function timeUntilProtest(iso: string, time = '12:00'): string {
  // Postgres `time` columns serialize as "HH:MM:SS"; trim to "HH:MM" first
  // so the concatenated string is a valid ISO timestamp instead of
  // "2026-06-23T14:00:00:00" (which parses as NaN).
  const normalized = time.length >= 5 ? time.slice(0, 5) : time
  const target = new Date(`${iso}T${normalized}:00`).getTime()
  const now = Date.now()
  const diff = target - now
  if (diff <= 0) return 'Happening now'
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

export default function ProtestEventCard({ event }: { event: ProtestEvent }) {
  // For recurring events the countdown chases the next occurrence, not the
  // series start (which may be in the past).
  const recurring = isRecurring(asRecurring(event))
  const baseDate = recurring
    ? nextOccurrence(asRecurring(event)) ?? event.date
    : event.date
  const [countdown, setCountdown] = useState<string>(
    timeUntilProtest(baseDate, event.time),
  )

  useEffect(() => {
    const id = setInterval(() => {
      const d = recurring ? nextOccurrence(asRecurring(event)) ?? event.date : event.date
      setCountdown(timeUntilProtest(d, event.time))
    }, 1000)
    return () => clearInterval(id)
  }, [event, recurring])

  return (
    <motion.article
      layout
      className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-6 sm:p-7 transition-all duration-500 hover:border-flame-500/40 hover:-translate-y-0.5"
    >
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-flame-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      {/* Stretched link: clicking anywhere on the card navigates to the
          event detail page. Sits at z-[1] above the decorative blob but
          below every content row (z-10) so the inner action buttons
          (Contact / Telegram / WhatsApp) stay independently clickable. */}
      <Link
        href={`/events/${event.slug}`}
        aria-label={`View ${event.title}`}
        className="absolute inset-0 z-[1] rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500/60"
      >
        <span className="sr-only">View {event.title}</span>
      </Link>
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-2xl text-white truncate">{event.title}</h3>
          <p className="text-xs text-white/50 truncate mt-1">
            {event.placeName ? `${event.placeName} · ` : ''}
            {event.country}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-xs text-flame-400 tabular-nums tracking-tight">{countdown}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/35 mt-0.5">until start</div>
        </div>
      </div>

      {event.description && (
        <p className="relative mt-5 text-sm leading-relaxed text-white/65 line-clamp-3">
          {event.description}
        </p>
      )}

      <div className="relative mt-5 grid grid-cols-2 gap-2 text-xs">
        <Meta icon={<Clock3 className="h-3.5 w-3.5" />}>
          {formatProtestDate(baseDate)} · {formatEventTimeLabel(event.time)}
        </Meta>
        {recurring && (
          <Meta icon={<Repeat className="h-3.5 w-3.5" />}>
            {recurrenceLabel(asRecurring(event))}
          </Meta>
        )}
        {event.expectedAttendees != null && (
          <Meta icon={<Users className="h-3.5 w-3.5" />}>
            {formatProtestNumber(event.expectedAttendees)} expected
          </Meta>
        )}
        {event.address && (
          <Meta icon={<MapPin className="h-3.5 w-3.5" />} className="col-span-2">
            {event.address}
          </Meta>
        )}
      </div>

      <div className="relative z-10 mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-5">
        <Link
          href={`/events/${event.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-flame-500/15 px-3 py-1.5 text-xs text-flame-200 ring-1 ring-flame-500/30 transition hover:bg-flame-500/25"
        >
          View event
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {event.organizerContact && (
          <a
            href={`mailto:${event.organizerContact}`}
            className="relative inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] transition"
          >
            <Megaphone className="h-3.5 w-3.5" />
            Contact
          </a>
        )}
        {event.telegramLink && (
          <a
            href={event.telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] transition"
          >
            <Send className="h-3.5 w-3.5" />
            Telegram
          </a>
        )}
        {event.whatsappLink && (
          <a
            href={event.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] transition"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        )}
      </div>
    </motion.article>
  )
}

function Meta({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-white/65 ${className || ''}`}>
      <span className="text-flame-400">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  )
}
