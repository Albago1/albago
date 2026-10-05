'use client'

import Link from 'next/link'
import SaveEventButton from '@/components/SaveEventButton'
import ShareCardButton from '@/components/share/ShareCardButton'
import { compactPrice } from '@/lib/ticketDisplay'
import type { EventCardProps } from './EventCard'
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

/**
 * Landscape event card for rows of two on desktop: the full poster on the
 * left, details on the right, all over a backdrop tinted by the poster's own
 * colours. Keeps the poster uncropped where a wide image would cut it.
 */
export default function EventWideCard({
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
      className="on-media group relative flex h-[330px] overflow-hidden rounded-[30px] bg-ink-950/80 ring-1 ring-white/10 transition duration-500 hover:ring-white/20"
    >
      <PosterGlow
        src={posterUrl}
        className="absolute inset-0 scale-125 opacity-70 blur-3xl saturate-150"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/30 via-black/65 to-black/85" />

      <div className="relative m-4 aspect-[4/5] h-[298px] shrink-0 overflow-hidden rounded-[22px] ring-1 ring-white/20 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]">
        <PosterArt
          src={posterUrl}
          alt={info.title}
          category={event.category}
          sizes="240px"
          onFail={markPosterFailed}
          className="transition duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col py-6 pl-2 pr-6">
        <div className="flex items-start justify-between gap-2">
          <DateTile info={info} />
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

        <div className="mt-auto">
          <Kicker info={info} />
          <h3 className="mt-1.5 line-clamp-3 font-display text-[30px] leading-[1.02] tracking-[-0.01em] text-white">
            {info.title}
          </h3>
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
