'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import { pickLocalized } from './LocalizedEventText'
import { CATEGORY_GRADIENTS, CATEGORY_ICONS, categoryLabel } from './categoryMeta'
import type { PublicEvent } from './EventCard'
import { formatEventTimeLabel, getTodayDateString } from '@/lib/dateFilters'
import {
  durationDaysLabel,
  isMultiDay,
  isRecurring,
  multiDayDurationDays,
  nextOccurrence,
  recurrenceLabel,
} from '@/lib/recurrence'
import { displayPrice, formatPriceFrom } from '@/lib/ticketDisplay'

// Shared building blocks for the poster-style event surfaces (EventCard,
// EventWideCard, EventSpotlight) so all three read as one family.

// Semantic per-category dot colours (same hues as the category chips).
const CATEGORY_DOTS: Record<string, string> = {
  nightlife: 'bg-fuchsia-400',
  music: 'bg-violet-400',
  sports: 'bg-emerald-400',
  culture: 'bg-sky-400',
  food: 'bg-amber-400',
}

/** Everything a poster surface prints about an event, already localized. */
export function useEventDisplay(event: PublicEvent) {
  const { language, t } = useLanguage()
  const locale = languageLocales[language]
  const recurring = isRecurring(event)
  const multiDay = isMultiDay(event) && !!event.end_date

  // Recurring events show their next occurrence, one-offs their own date.
  const dateIso = (recurring ? nextOccurrence(event) : null) ?? event.date
  const dateObj = new Date(`${dateIso}T12:00:00`)
  const endObj = multiDay ? new Date(`${event.end_date}T12:00:00`) : null

  const todayIso = getTodayDateString()
  const tomorrowIso = new Date(new Date(`${todayIso}T12:00:00`).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10)

  // Structured price beats the legacy display string when present.
  const price =
    event.ticket_sales_status === 'sold_out'
      ? 'Sold out'
      : event.price_from_cents != null
        ? event.price_from_cents === 0
          ? 'Free'
          : `From ${formatPriceFrom(event.price_from_cents, event.price_currency ?? null)}`
        : displayPrice(event.price)

  return {
    title: pickLocalized(event.title, event.title_i18n, language),
    category: categoryLabel(event.category, t),
    day: dateObj.getDate(),
    month: dateObj.toLocaleDateString(locale, { month: 'short' }),
    weekday: dateObj.toLocaleDateString(locale, { weekday: 'long' }),
    longDate: dateObj.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    endDay: endObj?.getDate() ?? null,
    endMonth: endObj?.toLocaleDateString(locale, { month: 'short' }) ?? '',
    // "Tonight"/"Tomorrow" sits next to the time — the date tile always
    // keeps the real calendar date.
    friendlyLabel:
      dateIso === todayIso ? t('tonight') : dateIso === tomorrowIso ? t('tomorrow') : null,
    // What the kicker leads with when there is no friendly label.
    lead: multiDay
      ? `${durationDaysLabel(multiDayDurationDays(event.date, event.end_date!))} event`
      : recurring
        ? recurrenceLabel(event)
        : null,
    time: formatEventTimeLabel(event.time),
    price,
    hot: !!event.highlight,
    hotLabel: t('hot'),
  }
}

export type EventDisplay = ReturnType<typeof useEventDisplay>

/** The poster URL, or null once it has failed to load (dead host). */
export function usePoster(url: string | null | undefined) {
  const [failed, setFailed] = useState(false)
  return [failed ? null : url ?? null, () => setFailed(true)] as const
}

/** The poster image, or the designed no-image backdrop for its category. */
export function PosterArt({
  src,
  alt,
  category,
  sizes,
  onFail,
  priority,
  className = '',
}: {
  src: string | null
  alt: string
  category: string
  sizes: string
  onFail?: () => void
  priority?: boolean
  className?: string
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={!src.includes('.supabase.co')}
        onError={onFail}
        className={`object-cover ${className}`}
      />
    )
  }
  const key = category?.toLowerCase() ?? ''
  const Icon = CATEGORY_ICONS[key] ?? CATEGORY_ICONS.all
  const gradient = CATEGORY_GRADIENTS[key] ?? 'from-white/10 via-ink-900 to-ink-950'
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-flame-500/20 blur-3xl" />
      <Icon className="absolute right-6 top-16 h-28 w-28 text-white/20 opacity-40" />
    </div>
  )
}

/** Poster-coloured light: a tiny, heavily blurred copy of the poster. Used as
 *  the glow under cards and as the backdrop of wide/spotlight surfaces. */
export function PosterGlow({ src, className = '' }: { src: string | null; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className}`}>
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="96px"
          unoptimized={!src.includes('.supabase.co')}
          className="object-cover"
        />
      ) : (
        <div className="h-full w-full bg-flame-500/40" />
      )}
    </div>
  )
}

/** Glass calendar tile: month over a big serif day (or day range). */
export function DateTile({ info, size = 'md' }: { info: EventDisplay; size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <div
      className={`flex flex-col items-center rounded-2xl bg-ink-950/45 ring-1 ring-white/15 backdrop-blur-xl ${
        lg ? 'min-w-[4.25rem] px-3 pb-2.5 pt-2' : 'min-w-[3.25rem] px-2.5 pb-2 pt-1.5'
      }`}
    >
      <span
        className={`font-bold uppercase tracking-[0.18em] text-flame-300 ${lg ? 'text-[11px]' : 'text-[10px]'}`}
      >
        {info.endDay != null && info.endMonth !== info.month
          ? `${info.month}–${info.endMonth}`
          : info.month}
      </span>
      <span className={`font-display leading-none text-white ${lg ? 'text-[38px]' : 'text-[28px]'}`}>
        {info.day}
        {info.endDay != null && (
          <>
            <span className="text-flame-300">–</span>
            {info.endDay}
          </>
        )}
      </span>
    </div>
  )
}

/** "SATURDAY · 21:00" — or a flame "Tonight" chip in place of the weekday. */
export function Kicker({ info, long = false }: { info: EventDisplay; long?: boolean }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
      {info.friendlyLabel ? (
        <span className="rounded-full bg-flame-500 px-2 py-0.5 tracking-[0.12em] text-white">
          {info.friendlyLabel}
        </span>
      ) : (
        <span className="truncate">{info.lead ?? (long ? info.longDate : info.weekday)}</span>
      )}
      {info.time && (
        <>
          <span className="text-white/40">·</span>
          <span className="shrink-0 text-flame-300">{info.time}</span>
        </>
      )}
    </p>
  )
}

/** Category dot + label · place. */
export function MetaLine({
  category,
  label,
  place,
  className = 'text-[13px]',
}: {
  category: string
  label: string
  place: string
  className?: string
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2 text-white/75 ${className}`}>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOTS[category?.toLowerCase() ?? ''] ?? 'bg-white/40'}`}
      />
      <span className="truncate">
        {label}
        <span className="text-white/40"> · </span>
        {place}
      </span>
    </span>
  )
}

export function PricePill({ label }: { label: string }) {
  return (
    <span className="max-w-[45%] shrink-0 truncate rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-xl">
      {label}
    </span>
  )
}
