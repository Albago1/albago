'use client'

import Link from 'next/link'
import SaveEventButton from '@/components/SaveEventButton'
import ShareCardButton from '@/components/share/ShareCardButton'
import { compactPrice } from '@/lib/ticketDisplay'
import {
  DateTile,
  Kicker,
  MetaLine,
  PosterArt,
  PosterGlow,
  PricePill,
  useEventDisplay,
  usePoster,
} from './posterParts'

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

export type EventCardProps = {
  event: PublicEvent
  venueName: string | null
  cityLabel: string
  isAuthenticated: boolean
  initialSaved: boolean
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
  const info = useEventDisplay(event)
  const [posterUrl, markPosterFailed] = usePoster(event.banner_url)

  return (
    <Link
      href={`/events/${event.slug}`}
      className="on-media group relative block h-full"
    >
      <PosterGlow
        src={posterUrl}
        className="absolute inset-x-5 -bottom-3 top-12 rounded-[40px] opacity-40 blur-2xl transition duration-500 group-hover:opacity-70"
      />

      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-ink-950/80 ring-1 ring-white/10 transition duration-500 group-hover:ring-white/20">
        <PosterArt
          src={posterUrl}
          alt={info.title}
          category={event.category}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          onFail={markPosterFailed}
          className="transition duration-700 ease-out group-hover:scale-[1.04]"
        />

        {/* Legibility: a light wash under the top controls, then a progressive
            blur + dark fade under the text. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="poster-fade pointer-events-none absolute inset-x-0 bottom-0 h-[55%] backdrop-blur-xl" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Top — date tile (+ hot) left, share + save right */}
        <div className="absolute inset-x-3.5 top-3.5 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5">
            <DateTile info={info} />
            {info.hot && (
              <span className="mt-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                {info.hotLabel}
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
          <Kicker info={info} />
          <h2 className="mt-1.5 line-clamp-2 font-display text-[28px] leading-[1.04] tracking-[-0.01em] text-white">
            {info.title}
          </h2>
          <div className="mt-3.5 flex items-center justify-between gap-3">
            <MetaLine
              category={event.category}
              label={info.category}
              place={venueName ? `${venueName}, ${cityLabel}` : cityLabel}
            />
            {info.price && <PricePill label={compactPrice(info.price)} />}
          </div>
        </div>
      </div>
    </Link>
  )
}
