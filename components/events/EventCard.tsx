'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import SaveEventButton from '@/components/SaveEventButton'
import ShareCardButton from '@/components/share/ShareCardButton'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import { pickLocalized } from './LocalizedEventText'
import { CATEGORY_GRADIENTS, CATEGORY_ICONS, categoryLabel } from './categoryMeta'
import { formatEventTimeLabel, getTodayDateString } from '@/lib/dateFilters'
import {
  durationDaysLabel,
  isMultiDay,
  isRecurring,
  multiDayDurationDays,
  nextOccurrence,
  recurrenceLabel,
} from '@/lib/recurrence'
import { compactPrice, displayPrice, formatPriceFrom } from '@/lib/ticketDisplay'

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

// Semantic per-category dot colours (same hues as the category chips).
const CATEGORY_DOTS: Record<string, string> = {
  nightlife: 'bg-fuchsia-400',
  music: 'bg-violet-400',
  sports: 'bg-emerald-400',
  culture: 'bg-sky-400',
  food: 'bg-amber-400',
}

/**
 * Poster-first event card (Apple TV / App Store pattern): the artwork fills a
 * tall card, the title sits on the image over a progressive blur, and a soft
 * glow in the poster's own colours bleeds out underneath. Wrapped in
 * `.on-media` so it stays dark-on-photo in the light theme too.
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
  const multiDay = isMultiDay(event) && !!event.end_date

  // A poster whose host is down falls back to the designed no-image card.
  const [imageFailed, setImageFailed] = useState(false)
  const posterUrl = !imageFailed ? event.banner_url ?? null : null

  // Structured price beats the legacy display string when present.
  const cardPrice =
    event.ticket_sales_status === 'sold_out'
      ? 'Sold out'
      : event.price_from_cents != null
        ? event.price_from_cents === 0
          ? 'Free'
          : `From ${formatPriceFrom(event.price_from_cents, event.price_currency ?? null)}`
        : displayPrice(event.price)

  // Date tile: recurring events show their next occurrence, one-offs their
  // own date. Big serif day number matches the share-poster brand pattern.
  const displayDateIso = (recurring ? nextOccurrence(event) : null) ?? event.date
  const dateObj = new Date(`${displayDateIso}T12:00:00`)
  const day = dateObj.getDate()
  const month = dateObj.toLocaleDateString(locale, { month: 'short' })
  const weekday = dateObj.toLocaleDateString(locale, { weekday: 'long' })

  const endObj = multiDay ? new Date(`${event.end_date}T12:00:00`) : null
  const endDay = endObj?.getDate() ?? null
  const endMonth = endObj?.toLocaleDateString(locale, { month: 'short' }) ?? ''

  // Friendly chip in the kicker — the tile always keeps the real calendar
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

  const kickerLead = multiDay
    ? `${durationDaysLabel(multiDayDurationDays(event.date, event.end_date!))} event`
    : recurring
      ? recurrenceLabel(event)
      : weekday
  const timeLabel = formatEventTimeLabel(event.time)

  return (
    <Link
      href={`/events/${event.slug}`}
      className="on-media group relative block h-full"
    >
      {/* Ambient glow — a tiny blurred copy of the poster bleeding its
          colours out under the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-5 -bottom-3 top-12 overflow-hidden rounded-[40px] opacity-40 blur-2xl transition duration-500 group-hover:opacity-70"
      >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt=""
            fill
            sizes="96px"
            unoptimized={!posterUrl.includes('.supabase.co')}
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-flame-500/40" />
        )}
      </div>

      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-ink-950/80 ring-1 ring-white/10 transition duration-500 group-hover:ring-white/20">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            unoptimized={!posterUrl.includes('.supabase.co')}
            onError={() => setImageFailed(true)}
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
            <div className="absolute inset-0 bg-grid opacity-40" />
            <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-flame-500/20 blur-3xl" />
            <Icon className="absolute right-6 top-16 h-28 w-28 text-white/20 opacity-40" />
          </div>
        )}

        {/* Legibility: a light wash under the top controls, then a progressive
            blur + dark fade under the text. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="poster-fade pointer-events-none absolute inset-x-0 bottom-0 h-[55%] backdrop-blur-xl" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Top — date tile (+ hot) left, share + save right */}
        <div className="absolute inset-x-3.5 top-3.5 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5">
            <div className="flex min-w-[3.25rem] flex-col items-center rounded-2xl bg-ink-950/45 px-2.5 pb-2 pt-1.5 ring-1 ring-white/15 backdrop-blur-xl">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-flame-300">
                {endDay != null && endMonth !== month ? `${month}–${endMonth}` : month}
              </span>
              <span className="font-display text-[28px] leading-none text-white">
                {day}
                {endDay != null && (
                  <>
                    <span className="text-flame-300">–</span>
                    {endDay}
                  </>
                )}
              </span>
            </div>
            {event.highlight && (
              <span className="mt-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
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

        {/* Bottom — kicker, title, meta + price */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            {friendlyLabel ? (
              <span className="rounded-full bg-flame-500 px-2 py-0.5 tracking-[0.12em] text-white">
                {friendlyLabel}
              </span>
            ) : (
              <span className="truncate">{kickerLead}</span>
            )}
            {timeLabel && (
              <>
                <span className="text-white/40">·</span>
                <span className="shrink-0 text-flame-300">{timeLabel}</span>
              </>
            )}
          </p>

          <h2 className="mt-1.5 line-clamp-2 font-display text-[28px] leading-[1.04] tracking-[-0.01em] text-white">
            {displayTitle}
          </h2>

          <div className="mt-3.5 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-white/75">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOTS[category] ?? 'bg-white/40'}`}
              />
              <span className="truncate">
                {categoryLabel(event.category, t)}
                <span className="text-white/40"> · </span>
                {venueName ? `${venueName}, ${cityLabel}` : cityLabel}
              </span>
            </span>
            {cardPrice && (
              <span className="max-w-[45%] shrink-0 truncate rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-xl">
                {compactPrice(cardPrice)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
