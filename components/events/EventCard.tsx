'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, MapPin, Repeat } from 'lucide-react'
import SaveEventButton from '@/components/SaveEventButton'
import ShareCardButton from '@/components/share/ShareCardButton'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import { pickLocalized } from './LocalizedEventText'
import { CATEGORY_GRADIENTS, CATEGORY_ICONS, categoryLabel, getCategoryTone } from './categoryMeta'
import { formatEventTimeLabel, getTodayDateString } from '@/lib/dateFilters'
import {
  dateRangeLong,
  durationDaysLabel,
  isMultiDay,
  isRecurring,
  multiDayDurationDays,
  nextOccurrence,
  recurrenceLabel,
} from '@/lib/recurrence'
import { formatPriceFrom } from '@/lib/ticketDisplay'

export type PublicEvent = {
  id: string
  title: string
  /** LENS-3 per-language title pack (en/sq/de/es). Present on scanned/pasted
   *  events; when absent the card shows the original title. */
  title_i18n?: Record<string, string> | null
  slug: string
  place_id: string | null
  category: string
  description: string
  date: string
  /** Last day of a multi-day continuous event (festival). Optional — feeding
   *  queries that don't select it just render a single-day card. */
  end_date?: string | null
  time: string
  price: string | null
  /** Structured external-ticket fields — present when the feeding query
   *  selects them; the card falls back to the `price` string otherwise. */
  price_from_cents?: number | null
  price_currency?: string | null
  ticket_sales_status?: string | null
  highlight: boolean | null
  status: string
  location_slug: string
  country: string
  region: string | null
  tags?: string[] | null
  is_online?: boolean | null
  banner_url?: string | null
  recurrence?: string | null
  recurrence_until?: string | null
  recurrence_days_of_week?: number[] | null
  recurrence_exceptions?: string[] | null
}

type EventCardProps = {
  event: PublicEvent
  venueName: string | null
  cityLabel: string
  isAuthenticated: boolean
  initialSaved: boolean
}

/**
 * Image-first event card (DICE / Fever pattern): banner on top with the
 * category, save button, and date overlaid; a fixed-structure body below so
 * every card in a row is the same height regardless of content length.
 */
export default function EventCard({
  event,
  venueName,
  cityLabel,
  isAuthenticated,
  initialSaved,
}: EventCardProps) {
  const { language, t } = useLanguage()
  const locale = languageLocales[language]
  const displayTitle = pickLocalized(event.title, event.title_i18n, language)
  const category = event.category?.toLowerCase() ?? ''
  const Icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.all
  const gradient = CATEGORY_GRADIENTS[category] ?? 'from-white/10 via-ink-900 to-ink-950'
  const recurring = isRecurring(event)
  const multiDay = isMultiDay(event)

  // Structured price beats the legacy display string when present.
  const cardPrice =
    event.ticket_sales_status === 'sold_out'
      ? 'Sold out'
      : event.price_from_cents != null
        ? event.price_from_cents === 0
          ? 'Free'
          : `From ${formatPriceFrom(event.price_from_cents, event.price_currency ?? null)}`
        : event.price

  // Calendar-tile date: recurring events show their next occurrence, one-offs
  // their own date. Big day number matches the ProtestCard / share-poster
  // brand pattern.
  const displayDateIso = (recurring ? nextOccurrence(event) : null) ?? event.date
  const dateObj = new Date(`${displayDateIso}T12:00:00`)
  const day = dateObj.getDate()
  const month = dateObj.toLocaleDateString(locale, { month: 'short' })
  const weekday = dateObj.toLocaleDateString(locale, { weekday: 'short' })

  // Multi-day events show a mini two-day tile (first → last) instead of one day.
  const endObj =
    multiDay && event.end_date ? new Date(`${event.end_date}T12:00:00`) : null
  const endDay = endObj?.getDate() ?? null
  const endMonth = endObj?.toLocaleDateString(locale, { month: 'short' }) ?? ''

  // Friendly chip next to the tile — the tile always keeps the real calendar
  // date, "Tonight"/"Tomorrow" never replaces it.
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

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-flame-500/30 hover:bg-white/[0.05] hover:shadow-[0_20px_50px_rgba(238,28,37,0.18)]"
    >
      {/* Media */}
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden">
        {event.banner_url ? (
          <Image
            src={event.banner_url}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} transition duration-500 ease-out group-hover:scale-105`}
          >
            <div className="absolute inset-0 bg-grid opacity-30" />
            <Icon className="relative h-12 w-12 text-white/20 transition duration-500 group-hover:scale-110 group-hover:text-white/30" />
          </div>
        )}

        {/* Legibility washes for the overlaid chips */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-transparent to-ink-950/40" />

        {/* Top overlay — category + hot + save */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize backdrop-blur-md ${getCategoryTone(event.category)}`}
            >
              {categoryLabel(event.category, t)}
            </span>
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
              city={cityLabel}
              country={event.country}
            />
            <SaveEventButton
              eventId={event.id}
              initialSaved={initialSaved}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </div>

        {/* Bottom overlay — calendar date tile + friendly/recurrence chips */}
        <div className="absolute inset-x-3 bottom-3 flex items-end gap-2">
          {endDay != null ? (
            <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-ink-950/80 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition duration-300 group-hover:border-flame-500/30">
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
            <div className="flex min-w-[3.4rem] flex-col items-center rounded-2xl border border-white/10 bg-ink-950/80 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition duration-300 group-hover:border-flame-500/30">
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
                {recurrenceLabel(event)}
              </span>
            )}
            {multiDay && event.end_date && (
              <span className="rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-medium text-flame-200 backdrop-blur-md">
                {durationDaysLabel(
                  multiDayDurationDays(event.date, event.end_date),
                )}{' '}
                event
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body — fixed structure so cards stay uniform */}
      <div className="flex flex-1 flex-col p-4">
        {/* Kicker — DICE-style date · time line anchoring the body */}
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-flame-300">
          {multiDay && event.end_date
            ? dateRangeLong(event.date, event.end_date)
            : `${weekday} ${day} ${month}`}
          {formatEventTimeLabel(event.time) && <> · {formatEventTimeLabel(event.time)}</>}
        </p>

        <h2 className="mt-1.5 line-clamp-2 min-h-[3.5rem] font-display text-[1.4rem] leading-[1.25] text-white">
          {displayTitle}
        </h2>

        <div className="mt-2 flex items-center gap-1.5 text-sm">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-white/40" />
          <span className="truncate text-white/70">
            {venueName ? (
              <>
                {venueName}
                <span className="text-white/40"> · {cityLabel}</span>
              </>
            ) : (
              cityLabel
            )}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
          {cardPrice ? (
            <span className="truncate text-sm font-semibold text-white">
              {cardPrice}
            </span>
          ) : (
            <span aria-hidden />
          )}
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/45 transition group-hover:text-flame-400">
            {t('card_view_event')}
            <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
