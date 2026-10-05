'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SaveEventButton from '@/components/SaveEventButton'
import ShareCardButton from '@/components/share/ShareCardButton'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
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
 * Full-width feature for a shelf holding a single event (Apple TV "featured"
 * banner): the uncropped poster on the left, a big title and actions on the
 * right, over a backdrop tinted by the poster's own colours. Desktop only —
 * phones show the regular poster card.
 */
export default function EventSpotlight({
  event,
  venueName,
  cityLabel,
  isAuthenticated,
  initialSaved,
  label,
}: EventCardProps & { label: string }) {
  const { t } = useLanguage()
  const info = useEventDisplay(event)
  const [posterUrl, markPosterFailed] = usePoster(event.banner_url)

  return (
    <Link
      href={`/events/${event.slug}`}
      className="on-media group relative block overflow-hidden rounded-[36px] bg-ink-950/80 ring-1 ring-white/10 transition duration-500 hover:ring-white/20"
    >
      <PosterGlow
        src={posterUrl}
        className="absolute inset-0 scale-125 opacity-70 blur-3xl saturate-150"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      <div className="relative grid grid-cols-[300px_minmax(0,1fr)] items-center gap-10 p-10">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[26px] ring-1 ring-white/20 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.8)]">
          <PosterArt
            src={posterUrl}
            alt={info.title}
            category={event.category}
            sizes="300px"
            onFail={markPosterFailed}
            className="transition duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute left-3.5 top-3.5">
            <DateTile info={info} />
          </div>
        </div>

        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-flame-500/15 px-3 py-1 text-xs font-semibold text-flame-200 ring-1 ring-flame-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-flame-400" />
            {label}
          </span>
          <div className="mt-6">
            <Kicker info={info} long />
          </div>
          <h3 className="mt-3 line-clamp-3 font-display text-[60px] leading-[0.98] tracking-[-0.01em] text-white">
            {info.title}
          </h3>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <MetaLine
              category={event.category}
              label={info.category}
              place={venueName ? `${venueName}, ${cityLabel}` : cityLabel}
              className="text-[15px]"
            />
            {info.price && <PricePill label={compactPrice(info.price)} />}
          </div>
          <div className="mt-9 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_-6px_rgba(238,28,37,0.7)] transition group-hover:bg-flame-400">
              {t('card_view_event')}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
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
      </div>
    </Link>
  )
}
