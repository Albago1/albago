'use client'

import Image from 'next/image'
import {
  Clock3,
  Flame,
  Globe2,
  MapPin,
  Megaphone,
  Ticket,
  Users,
} from 'lucide-react'
import { CATEGORY_GRADIENTS, CATEGORY_ICONS, getCategoryTone } from './categoryMeta'
import { formatEventDateLabel, formatEventTimeLabel } from '@/lib/dateFilters'

/**
 * Plain-data replica of the public event page (phase-29 layout: image-led
 * hero with kicker + serif title, action panel with calendar tile and Where
 * block, then the content column). Used to preview an event BEFORE it exists
 * as a page: admin moderation queue and the submit wizard's review step.
 * Purely presentational — pass whatever fields you have; missing ones
 * collapse. Rendered at modal width, it mirrors the live page's mobile order.
 */
export type EventPreviewData = {
  title: string
  category: string
  date: string
  time?: string | null
  end_time?: string | null
  price?: string | null
  description?: string | null
  banner_url?: string | null
  gallery_urls?: string[] | null
  venue_name?: string | null
  address?: string | null
  address_hint?: string | null
  cityLabel?: string | null
  country?: string | null
  is_online?: boolean | null
  online_url?: string | null
  is_civic?: boolean | null
  expected_attendees?: number | null
  telegram_link?: string | null
  whatsapp_link?: string | null
  safety_notes?: string | null
  tags?: string[] | null
  organizer_name?: string | null
}

function kickerLine(date: string, time?: string | null, endTime?: string | null): string {
  const d = new Date(`${date}T12:00:00`)
  const day = d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const start = time ? formatEventTimeLabel(time) : ''
  const end = endTime ? formatEventTimeLabel(endTime) : ''
  const range = start ? (end ? `${start} → ${end}` : start) : ''
  return [day, range].filter(Boolean).join(' · ')
}

function DateTile({ iso }: { iso: string }) {
  const d = new Date(`${iso}T12:00:00`)
  return (
    <div className="flex w-[64px] shrink-0 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-flame-300">
        {d.toLocaleDateString('en-GB', { month: 'short' })}
      </span>
      <span className="font-display text-2xl leading-none text-white">{d.getDate()}</span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50">
        {d.toLocaleDateString('en-GB', { weekday: 'short' })}
      </span>
    </div>
  )
}

export default function EventPagePreview({ event }: { event: EventPreviewData }) {
  const heroImage = event.banner_url || event.gallery_urls?.[0] || null
  const gradient =
    CATEGORY_GRADIENTS[event.category?.toLowerCase() ?? ''] ??
    'from-white/10 via-ink-900 to-ink-950'
  const CategoryIcon = CATEGORY_ICONS[event.category?.toLowerCase() ?? ''] ?? Megaphone
  const locationLine = [event.cityLabel, event.country].filter(Boolean).join(', ')
  const timeRange = event.time
    ? `${formatEventTimeLabel(event.time)}${
        event.end_time ? ` → ${formatEventTimeLabel(event.end_time)}` : ''
      }`
    : ''
  const extraGallery = (event.gallery_urls ?? []).filter((u) => u && u !== heroImage)

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-ink-950 text-white">
      {/* Hero — image-led, bottom-anchored, like the live page */}
      <div className="relative flex aspect-[4/3] w-full flex-col justify-end overflow-hidden sm:aspect-[16/9]">
        {heroImage ? (
          <>
            <Image
              src={heroImage}
              alt={event.title}
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              unoptimized={!heroImage.includes('.supabase.co')}
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-ink-950/75" />
          </>
        ) : (
          <>
            <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradient}`}>
              <CategoryIcon className="h-14 w-14 text-white/15" />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />
          </>
        )}

        <div className={`relative p-5${heroImage ? ' on-media' : ''}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${getCategoryTone(event.category)}`}>
              {event.category}
            </span>
            {event.is_civic && (
              <span className="inline-flex items-center gap-1 rounded-full bg-flame-500/20 px-2.5 py-1 text-[11px] font-semibold text-flame-200 ring-1 ring-flame-500/40">
                <Flame className="h-3 w-3" />
                Civic
              </span>
            )}
            {event.is_online && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                <Globe2 className="h-3 w-3" />
                Online
              </span>
            )}
          </div>

          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.22em] text-flame-300">
            {kickerLine(event.date, event.time, event.end_time)}
          </p>

          <h2 className="display-text mt-1.5 text-3xl leading-[0.98] tracking-tight sm:text-4xl">
            {event.title}
          </h2>

          {(event.venue_name || locationLine || event.is_online) && (
            <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-sm text-white/85">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-white/60" />
              {event.venue_name && <span className="font-semibold">{event.venue_name}</span>}
              {event.venue_name && <span className="text-white/40">·</span>}
              <span className="text-white/65">
                {event.is_online ? 'Online event' : locationLine || '—'}
              </span>
            </p>
          )}

          {(event.tags?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {event.tags!.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/15 bg-ink-950/45 px-2.5 py-1 text-[11px] text-white/75"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Action panel replica — date tile, price, expected, Where */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3.5">
            <DateTile iso={event.date} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {formatEventDateLabel(event.date)}
              </p>
              {timeRange && (
                <p className="mt-1.5 inline-flex items-center gap-2 text-base font-semibold tabular-nums text-white">
                  <Clock3 className="h-4 w-4 text-flame-400" />
                  {timeRange}
                </p>
              )}
            </div>
          </div>

          {event.price && (
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-4">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                <Ticket className="h-3.5 w-3.5" />
                Price
              </span>
              <span className="text-base font-semibold text-white">{event.price}</span>
            </div>
          )}

          {event.is_civic && event.expected_attendees != null && event.expected_attendees > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-4">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-300/80">
                <Users className="h-3.5 w-3.5" />
                Expected
              </span>
              <span className="text-base font-semibold text-white">
                {event.expected_attendees.toLocaleString()}
              </span>
            </div>
          )}

          {!event.is_online && (event.address || locationLine) && (
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Where
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/80">
                {event.address || locationLine}
                {event.address_hint && (
                  <span className="block text-white/50">{event.address_hint}</span>
                )}
              </p>
              {event.address && locationLine && (
                <p className="mt-1 text-xs text-white/50">{locationLine}</p>
              )}
            </div>
          )}

          {event.is_online && event.online_url && (
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Where
              </p>
              <p className="mt-2 inline-flex items-center gap-2 break-all text-sm text-white/80">
                <Globe2 className="h-4 w-4 shrink-0 text-emerald-300" />
                {event.online_url}
              </p>
            </div>
          )}
        </div>

        {/* Content column replica */}
        {event.description && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              About this event
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/70">
              {event.description}
            </p>
          </div>
        )}

        {extraGallery.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {extraGallery.slice(0, 3).map((url) => (
              <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="200px"
                  unoptimized={!url.includes('.supabase.co')}
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {event.is_civic &&
          (event.telegram_link || event.whatsapp_link || event.safety_notes) && (
            <div className="rounded-2xl border border-flame-500/20 bg-flame-500/[0.05] p-4 text-sm text-white/70">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-300/80">
                Coordination
              </p>
              <div className="mt-2 space-y-1.5">
                {event.telegram_link && <p className="break-all">Telegram: {event.telegram_link}</p>}
                {event.whatsapp_link && <p className="break-all">WhatsApp: {event.whatsapp_link}</p>}
                {event.safety_notes && <p className="leading-5">Safety: {event.safety_notes}</p>}
              </div>
            </div>
          )}

        {event.organizer_name && (
          <p className="border-t border-white/[0.06] pt-4 text-xs text-white/50">
            Organizer: <span className="text-white/80">{event.organizer_name}</span>
          </p>
        )}
      </div>
    </div>
  )
}
