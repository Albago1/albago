'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Flame, MapPin, Repeat, Users, X } from 'lucide-react'
import SaveEventButton from '@/components/SaveEventButton'
import ShareCardButton from '@/components/share/ShareCardButton'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import {
  CATEGORY_GRADIENTS,
  CATEGORY_ICONS,
  categoryLabel,
  getCategoryTone,
} from '@/components/events/categoryMeta'
import { formatEventTimeLabel, getTodayDateString } from '@/lib/dateFilters'
import {
  dateRangeLong,
  isMultiDay,
  isRecurring,
  nextOccurrence,
  recurrenceLabel,
} from '@/lib/recurrence'

export type MapCardEvent = {
  id: string
  slug: string
  title: string
  category: string | null
  isCivic: boolean
  date: string
  /** Last day of a continuous multi-day event; renders a date range. */
  endDate?: string | null
  time: string | null
  country: string | null
  expectedAttendees: number | null
  bannerUrl: string | null
  price: string | null
  highlight: boolean
  recurrence: string | null
  recurrenceUntil: string | null
  recurrenceDaysOfWeek: number[] | null
  recurrenceExceptions: string[] | null
}

type MapEventCardProps = {
  event: MapCardEvent
  cityLabel: string | null
  isAuthenticated: boolean
  initialSaved: boolean
  onClose: () => void
}

function formatAttendees(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}

/**
 * Rich preview card for a selected map pin (Airbnb map-card pattern): the
 * same image-led visual system as EventCard — banner, falling back to the
 * event's cached AI poster, falling back to the branded category gradient —
 * with a calendar date tile, flame time kicker, and a single clear CTA.
 *
 * Mount with `key={event.id}` so the media fallback ladder resets per event.
 */
export default function MapEventCard({
  event,
  cityLabel,
  isAuthenticated,
  initialSaved,
  onClose,
}: MapEventCardProps) {
  const { language, t } = useLanguage()
  const locale = languageLocales[language]

  const category = event.category?.toLowerCase() ?? (event.isCivic ? 'civic' : '')
  const Icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.all
  const gradient = CATEGORY_GRADIENTS[category] ?? 'from-white/10 via-ink-900 to-ink-950'

  // Media ladder: banner → cached AI poster (exists for any event that was
  // ever shared / whose page was visited; misses 404) → category gradient.
  const posterUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-posters/${event.slug}.jpg`
  const [mediaSrc, setMediaSrc] = useState<string | null>(event.bannerUrl ?? posterUrl)
  const handleMediaError = () => {
    setMediaSrc((current) => (current === event.bannerUrl ? posterUrl : null))
  }

  const recurringShape = {
    date: event.date,
    end_date: event.endDate ?? null,
    time: event.time,
    recurrence: event.recurrence,
    recurrence_until: event.recurrenceUntil,
    recurrence_days_of_week: event.recurrenceDaysOfWeek,
    recurrence_exceptions: event.recurrenceExceptions,
  }
  const recurring = isRecurring(recurringShape)
  const multiDay = isMultiDay(recurringShape)
  const displayDateIso = (recurring ? nextOccurrence(recurringShape) : null) ?? event.date
  const dateObj = new Date(`${displayDateIso}T12:00:00`)
  const day = dateObj.getDate()
  const month = dateObj.toLocaleDateString(locale, { month: 'short' })
  const weekday = dateObj.toLocaleDateString(locale, { weekday: 'short' })

  // Multi-day events show a mini two-day tile (first → last) instead of one day.
  const endObj =
    multiDay && event.endDate ? new Date(`${event.endDate}T12:00:00`) : null
  const endDay = endObj?.getDate() ?? null
  const endMonth = endObj?.toLocaleDateString(locale, { month: 'short' }) ?? ''
  const timeLabel = event.time ? formatEventTimeLabel(event.time) : ''

  const todayIso = getTodayDateString()
  const tomorrowIso = new Date(new Date(`${todayIso}T12:00:00`).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10)
  const friendlyLabel =
    displayDateIso === todayIso
      ? t('tonight')
      : displayDateIso === tomorrowIso
        ? t('tomorrow')
        : null

  const locationLine = [cityLabel, event.country].filter(Boolean).join(', ')

  return (
    <div className="pointer-events-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-ink-950/95 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      {/* Media — dark art in both themes, so text on top stays white */}
      <div className="on-media relative aspect-[2/1] w-full overflow-hidden">
        {mediaSrc ? (
          <Image
            src={mediaSrc}
            alt={event.title}
            fill
            sizes="(max-width: 767px) 100vw, 400px"
            className="object-cover"
            onError={handleMediaError}
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient}`}
          >
            <div className="absolute inset-0 bg-grid opacity-30" />
            <Icon className="relative h-10 w-10 text-white/20" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-transparent to-ink-950/45" />

        {/* Top overlay — category / civic chips left, actions right */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {event.isCivic ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-flame-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-flame-300 ring-1 ring-flame-500/30 backdrop-blur-md">
                <Flame className="h-3 w-3" />
                {categoryLabel('civic', t)}
              </span>
            ) : (
              event.category && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize backdrop-blur-md ${getCategoryTone(event.category)}`}
                >
                  {categoryLabel(event.category, t)}
                </span>
              )
            )}
            {event.highlight && (
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                {t('hot')}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ShareCardButton
              eventId={event.id}
              slug={event.slug}
              title={event.title}
              city={cityLabel ?? ''}
              country={event.country ?? ''}
            />
            <SaveEventButton
              eventId={event.id}
              initialSaved={initialSaved}
              isAuthenticated={isAuthenticated}
            />
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(5,5,5,0.62)] text-[#fff] shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-[rgba(5,5,5,0.8)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Bottom overlay — calendar date tile + friendly/recurrence chips */}
        <div className="absolute inset-x-3 bottom-3 flex items-end gap-2">
          {endDay != null ? (
            <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-ink-950/80 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-flame-300">
                  {month}
                </span>
                <span className="mt-0.5 font-display text-2xl leading-none text-white">
                  {day}
                </span>
              </div>
              <span className="font-display text-lg leading-none text-flame-300/80">
                –
              </span>
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-flame-300">
                  {endMonth}
                </span>
                <span className="mt-0.5 font-display text-2xl leading-none text-white">
                  {endDay}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex min-w-[3.4rem] flex-col items-center rounded-2xl border border-white/10 bg-ink-950/80 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <span className="text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-flame-300">
                {month}
              </span>
              <span className="mt-1 font-display text-3xl leading-none text-white">
                {day}
              </span>
              <span className="mt-1 text-[9px] font-medium uppercase leading-none tracking-wider text-white/55">
                {weekday}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {friendlyLabel && (
              <span className="rounded-full bg-flame-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_4px_14px_rgba(238,28,37,0.45)]">
                {friendlyLabel}
              </span>
            )}
            {recurring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-medium text-flame-200 backdrop-blur-md">
                <Repeat className="h-3 w-3" />
                {recurrenceLabel(recurringShape)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-flame-300">
          {multiDay && event.endDate
            ? dateRangeLong(event.date, event.endDate)
            : `${weekday} ${day} ${month}`}
          {timeLabel && <> · {timeLabel}</>}
        </p>

        <h3 className="mt-1.5 line-clamp-2 font-display text-[1.35rem] leading-[1.25] text-white">
          {event.title}
        </h3>

        {(locationLine || (event.expectedAttendees ?? 0) > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {locationLine && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-white/40" />
                <span className="truncate text-white/70">{locationLine}</span>
              </span>
            )}
            {event.expectedAttendees != null && event.expectedAttendees > 0 && (
              <span className="inline-flex items-center gap-1.5 text-white/70">
                <Users className="h-3.5 w-3.5 shrink-0 text-white/40" />
                {formatAttendees(event.expectedAttendees)} {t('map_expected')}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
          {event.price ? (
            <span className="truncate text-sm font-semibold text-white">{event.price}</span>
          ) : (
            <span aria-hidden />
          )}
          <Link
            href={`/events/${event.slug}`}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-flame-500 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white shadow-glow-flame transition hover:bg-flame-400"
          >
            {t('map_open_event')}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
