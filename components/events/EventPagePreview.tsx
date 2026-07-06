'use client'

import Image from 'next/image'
import {
  Calendar,
  Clock3,
  Flame,
  Globe2,
  MapPin,
  Megaphone,
  Tag,
  Users,
} from 'lucide-react'
import { CATEGORY_GRADIENTS, CATEGORY_ICONS, getCategoryTone } from './categoryMeta'
import { formatEventDateLabel, formatEventTimeLabel } from '@/lib/dateFilters'

/**
 * Plain-data replica of the public event page's main content. Used to preview
 * an event BEFORE it exists as a page: admin moderation queue (pending
 * submissions) and the submit wizard's review step. Purely presentational —
 * pass whatever fields you have; missing ones collapse.
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

export default function EventPagePreview({ event }: { event: EventPreviewData }) {
  const heroImage = event.banner_url || event.gallery_urls?.[0] || null
  const gradient =
    CATEGORY_GRADIENTS[event.category?.toLowerCase() ?? ''] ??
    'from-white/10 via-ink-900 to-ink-950'
  const CategoryIcon = CATEGORY_ICONS[event.category?.toLowerCase() ?? ''] ?? Megaphone
  const locationLine = [event.cityLabel, event.country].filter(Boolean).join(', ')

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-ink-950 text-white">
      {/* Hero — banner photo or category gradient, like the live page */}
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            unoptimized={!heroImage.includes('.supabase.co')}
            className="object-cover"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient}`}>
            <CategoryIcon className="h-14 w-14 text-white/15" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/20 to-transparent" />

        <div className="absolute inset-x-5 bottom-4">
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
          <h2 className="display-text mt-2 text-3xl leading-tight sm:text-4xl">
            {event.title}
          </h2>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Meta rows — mirrors the live page's info strip */}
        <div className="flex flex-col gap-2.5 text-sm text-white/75">
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-4 w-4 text-flame-400" />
            {formatEventDateLabel(event.date)}
          </span>

          {event.time && (
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-flame-400" />
              {formatEventTimeLabel(event.time)}
              {event.end_time ? ` – ${formatEventTimeLabel(event.end_time)}` : ''}
            </span>
          )}

          {!event.is_online && (event.address || locationLine) && (
            <span className="inline-flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-flame-400" />
              <span className="whitespace-pre-line">
                {event.venue_name && (
                  <span className="block font-medium text-white">{event.venue_name}</span>
                )}
                {event.address || locationLine}
                {event.address && locationLine && (
                  <span className="block text-white/50">{locationLine}</span>
                )}
                {event.address_hint && (
                  <span className="block text-white/50">{event.address_hint}</span>
                )}
              </span>
            </span>
          )}

          {event.is_online && event.online_url && (
            <span className="inline-flex items-center gap-2 break-all">
              <Globe2 className="h-4 w-4 text-emerald-300" />
              {event.online_url}
            </span>
          )}

          {event.price && (
            <span className="inline-flex items-center gap-2">
              <Tag className="h-4 w-4 text-flame-400" />
              {event.price}
            </span>
          )}
        </div>

        {event.description && (
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              About this event
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/70">
              {event.description}
            </p>
          </div>
        )}

        {event.is_civic &&
          (event.expected_attendees != null ||
            event.telegram_link ||
            event.whatsapp_link ||
            event.safety_notes) && (
            <div className="rounded-2xl border border-flame-500/20 bg-flame-500/[0.05] p-4 text-sm text-white/70">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-300/80">
                Coordination
              </p>
              <div className="mt-2 space-y-1.5">
                {event.expected_attendees != null && event.expected_attendees > 0 && (
                  <p className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4 text-flame-400" />
                    {event.expected_attendees.toLocaleString()} expected
                  </p>
                )}
                {event.telegram_link && <p className="break-all">Telegram: {event.telegram_link}</p>}
                {event.whatsapp_link && <p className="break-all">WhatsApp: {event.whatsapp_link}</p>}
                {event.safety_notes && <p className="leading-5">Safety: {event.safety_notes}</p>}
              </div>
            </div>
          )}

        {(event.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags!.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60"
              >
                #{tag}
              </span>
            ))}
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
