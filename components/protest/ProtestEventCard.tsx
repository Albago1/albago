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
  Send,
  Users,
} from 'lucide-react'

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
  const target = new Date(`${iso}T${time}:00`).getTime()
  const now = Date.now()
  const diff = target - now
  if (diff <= 0) return 'Happening now'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function ProtestEventCard({ event }: { event: ProtestEvent }) {
  const [countdown, setCountdown] = useState<string>(timeUntilProtest(event.date, event.time))

  useEffect(() => {
    const id = setInterval(() => setCountdown(timeUntilProtest(event.date, event.time)), 60_000)
    return () => clearInterval(id)
  }, [event.date, event.time])

  return (
    <motion.article
      layout
      className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-6 sm:p-7 transition-all duration-500 hover:border-flame-500/40 hover:-translate-y-0.5"
    >
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-flame-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-2xl text-white truncate">{event.title}</h3>
          <p className="text-xs text-white/50 truncate mt-1">
            {event.placeName ? `${event.placeName} · ` : ''}
            {event.country}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-xs text-flame-400">{countdown}</div>
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
          {formatProtestDate(event.date)} · {event.time}
        </Meta>
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

      <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-5">
        <Link
          href={`/events/${event.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-flame-500/15 px-3 py-1.5 text-xs text-flame-200 ring-1 ring-flame-500/30 hover:bg-flame-500/25 transition"
        >
          View event
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {event.organizerContact && (
          <a
            href={`mailto:${event.organizerContact}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] transition"
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
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] transition"
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
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] transition"
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
