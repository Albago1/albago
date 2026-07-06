'use client'

import Link from 'next/link'
import { ArrowUpRight, Clock3, Flame, MapPin, Users } from 'lucide-react'
import { formatEventDateLabel, formatEventTimeLabel } from '@/lib/dateFilters'

export type ProtestCardData = {
  id: string
  slug: string
  title: string
  date: string
  time: string | null
  location_slug: string
  country: string
  expected_attendees: number | null
}

function formatExpected(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)
}

/**
 * Date-led protest card: protests are rally moments, not photo ops, so the
 * media slot is a flame-gradient header carrying a big calendar day instead
 * of a banner image. Fixed body structure keeps rows uniform in a grid.
 */
export default function ProtestCard({
  protest,
  cityLabel,
}: {
  protest: ProtestCardData
  cityLabel: string
}) {
  const d = new Date(`${protest.date}T00:00:00`)
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })

  return (
    <Link
      href={`/events/${protest.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md transition hover:border-flame-500/40 hover:bg-white/[0.05] hover:shadow-[0_20px_50px_rgba(238,28,37,0.2)]"
    >
      {/* Date hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-flame-600/30 via-ink-900 to-ink-950 p-5">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <Flame
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-5 h-28 w-28 rotate-12 text-flame-500/15 transition duration-500 group-hover:scale-110 group-hover:text-flame-500/25"
        />

        <div className="relative flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-6xl leading-none text-white">{day}</p>
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-flame-200">
              {month} · {weekday}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-flame-500/20 px-2.5 py-1 text-[11px] font-semibold text-flame-200 ring-1 ring-flame-500/40 backdrop-blur-md">
              <Flame className="h-3 w-3" />
              Civic
            </span>
            {protest.expected_attendees != null && protest.expected_attendees > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-950/60 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
                <Users className="h-3 w-3" />
                {formatExpected(protest.expected_attendees)} expected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body — fixed structure for uniform rows */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-[3.1rem] text-lg font-semibold leading-snug text-white">
            {protest.title}
          </h3>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-flame-400" />
        </div>

        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-white/55">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {cityLabel}
            {protest.country ? `, ${protest.country}` : ''}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm text-white/60">
          <span className="truncate">{formatEventDateLabel(protest.date)}</span>
          {protest.time && (
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              {formatEventTimeLabel(protest.time)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
