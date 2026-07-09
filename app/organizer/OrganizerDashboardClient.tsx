'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Flame,
  Globe,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import ShareModal from '@/components/share/ShareModal'
import EventPagePreview, {
  type EventPreviewData,
} from '@/components/events/EventPagePreview'
import { getLocationBySlug } from '@/lib/locations'
import Sparkline from '@/components/dashboard/Sparkline'
import TrendBadge from '@/components/dashboard/TrendBadge'
import { isEventActive } from '@/lib/eventActive'
import { formatEventDateLabel, formatEventTimeLabel } from '@/lib/dateFilters'
import { nextOccurrence, todayIso } from '@/lib/recurrence'
import type { ShareEventData } from '@/lib/share/types'
import type { Organizer } from '@/types/organizer'
import type { OrganizerEvent, EventStatus } from '@/types/event'

const ESTABLISHED_THRESHOLD = 2

function isRepostable(event: OrganizerEvent): boolean {
  if (event.status === 'completed' || event.status === 'cancelled') return true
  if (event.status === 'published' && !isEventActive(event)) return true
  return false
}

function statusLabel(status: EventStatus): string {
  switch (status) {
    case 'draft': return 'Draft'
    case 'pending_review': return 'Pending review'
    case 'published': return 'Published'
    case 'rejected': return 'Rejected'
    case 'cancelled': return 'Cancelled'
    case 'completed': return 'Completed'
  }
}

function statusStyle(status: EventStatus): string {
  switch (status) {
    case 'draft': return 'border-white/15 bg-white/[0.05] text-white/60'
    case 'pending_review': return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    case 'published': return 'border-flame-500/30 bg-flame-500/10 text-flame-400'
    case 'rejected': return 'border-red-500/20 bg-red-500/10 text-red-400'
    case 'cancelled': return 'border-white/10 bg-white/[0.03] text-white/40'
    case 'completed': return 'border-green-500/20 bg-green-500/10 text-green-400'
  }
}

function formatNumberCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

function eventToShareData(
  event: OrganizerEvent,
  organizer: Organizer,
): ShareEventData {
  return {
    title: event.title,
    slug: event.slug,
    category: event.category ?? null,
    city: event.location_slug,
    country: event.country ?? null,
    address: event.address ?? null,
    date: event.date,
    time: event.time,
    endTime: event.end_time,
    organizerName: organizer.display_name ?? null,
    isCivic: !!event.is_civic,
    eventUrl: `https://albago.org/events/${event.slug}`,
  }
}

function cityLabelFor(slug: string): string {
  const match = getLocationBySlug(slug)
  if (match.slug === slug) return match.label
  return slug
    .split('-')
    .map((part) => (part[0]?.toUpperCase() ?? '') + part.slice(1))
    .join(' ')
}

function eventToPreviewData(
  event: OrganizerEvent,
  organizer: Organizer,
): EventPreviewData {
  return {
    title: event.title,
    category: event.category,
    date: event.date,
    time: event.time,
    end_time: event.end_time,
    price: event.price,
    description: event.description,
    banner_url: event.banner_url,
    gallery_urls: event.gallery_urls ?? null,
    address: event.address,
    address_hint: event.address_hint ?? null,
    cityLabel: cityLabelFor(event.location_slug),
    country: event.country,
    is_online: event.is_online ?? null,
    online_url: event.online_url ?? null,
    is_civic: event.is_civic,
    expected_attendees: event.expected_attendees,
    telegram_link: event.telegram_link ?? null,
    whatsapp_link: event.whatsapp_link ?? null,
    safety_notes: event.safety_notes ?? null,
    tags: event.tags ?? null,
    organizer_name: event.organizer_name ?? organizer.display_name ?? null,
  }
}

/** Portal modal wrapping the live-page replica — "see it before it ships". */
function PreviewModal({
  event,
  organizer,
  onClose,
}: {
  event: OrganizerEvent
  organizer: Organizer
  onClose: () => void
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Event page preview"
    >
      <div
        className="relative w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            How your event page will look
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.25)] bg-[rgba(5,5,5,0.62)] text-[#ffffff] backdrop-blur-md transition hover:bg-[rgba(5,5,5,0.82)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <EventPagePreview event={eventToPreviewData(event, organizer)} />
      </div>
    </div>,
    document.body,
  )
}

/**
 * Bucket events into N daily slots ending at "today" using the given date
 * accessor. Returns an array of counts, oldest → newest, length = daysBack.
 */
function bucketByDay(
  events: OrganizerEvent[],
  daysBack: number,
  accessor: (e: OrganizerEvent) => string | null,
): number[] {
  const buckets = Array.from({ length: daysBack }, () => 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const e of events) {
    const raw = accessor(e)
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    d.setHours(0, 0, 0, 0)
    const days = Math.round((today.getTime() - d.getTime()) / 86_400_000)
    if (days < 0 || days >= daysBack) continue
    buckets[daysBack - 1 - days] += 1
  }
  return buckets
}

type EventRowProps = {
  event: OrganizerEvent
  organizer: Organizer
  canRepost: boolean
  studioAccess?: boolean
}

function EventRow({ event, organizer, canRepost, studioAccess }: EventRowProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const repostable = canRepost && isRepostable(event)
  const isEditable = event.status === 'draft' || event.status === 'rejected'

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-start">
      {event.banner_url ? (
        <div className="relative h-24 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:h-20 sm:w-28 sm:flex-shrink-0">
          <Image
            src={event.banner_url}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 100vw, 112px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="hidden h-20 w-28 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] sm:flex">
          <Calendar className="h-5 w-5 text-white/25" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{event.title}</p>
            <p className="mt-1 text-sm text-white/55">
              {formatEventDateLabel(event.date)}
              {event.time ? ` · ${formatEventTimeLabel(event.time)}` : ''}
              {' · '}
              <span className="capitalize">{event.category}</span>
            </p>
            {(event.expected_attendees ?? 0) > 0 && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/45">
                <Users className="h-3.5 w-3.5" />
                {formatNumberCompact(event.expected_attendees ?? 0)} expected
              </p>
            )}
          </div>
          <span
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(event.status)}`}
          >
            {statusLabel(event.status)}
          </span>
        </div>

        {event.status === 'rejected' && event.admin_note && (
          <div className="mt-3 rounded-xl border border-red-500/15 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            <span className="font-semibold">Feedback: </span>
            {event.admin_note}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {event.status === 'published' ? (
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
          )}
          {isEditable && (
            <Link
              href={`/organizer/create?draft=${event.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          )}
          {event.status === 'published' && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          )}
          {repostable && (
            <Link
              href={`/organizer/create?repost=${event.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-3 py-1.5 text-xs font-semibold text-flame-300 transition hover:border-flame-500/50 hover:bg-flame-500/[0.15] hover:text-flame-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Repost
            </Link>
          )}
        </div>
      </div>

      {event.status === 'published' && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          data={eventToShareData(event, organizer)}
          studioAccess={studioAccess}
        />
      )}

      {previewOpen && (
        <PreviewModal
          event={event}
          organizer={organizer}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}

export default function OrganizerDashboardClient({
  organizer,
  events,
  studioAccess = false,
}: {
  organizer: Organizer
  events: OrganizerEvent[]
  studioAccess?: boolean
}) {
  const canRepost = organizer.verification_tier === 'verified'

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.status === 'published' && isEventActive(e))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [events],
  )
  const past = useMemo(
    () =>
      events
        .filter(
          (e) =>
            (e.status === 'published' && !isEventActive(e)) ||
            e.status === 'completed' ||
            e.status === 'cancelled',
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [events],
  )
  const inFlight = useMemo(
    () =>
      events.filter(
        (e) =>
          e.status === 'draft' ||
          e.status === 'pending_review' ||
          e.status === 'rejected',
      ),
    [events],
  )
  const published = useMemo(
    () => events.filter((e) => e.status === 'published'),
    [events],
  )

  // Hero stat: total expected across published events. Subtitle: cities · countries.
  const audience = useMemo(() => {
    const expected = published.reduce(
      (sum, e) => sum + (e.expected_attendees ?? 0),
      0,
    )
    const cities = new Set(published.map((e) => e.location_slug).filter(Boolean)).size
    const countries = new Set(published.map((e) => e.country).filter(Boolean)).size
    return { expected, cities, countries }
  }, [published])

  // Sparklines: 14 daily buckets ending today. Counts: events created /
  // published / expected attendees per day. Trend = sum of last 7 vs prior 7.
  const created14 = useMemo(
    () => bucketByDay(events, 14, (e) => e.created_at),
    [events],
  )
  const published14 = useMemo(
    () => bucketByDay(events, 14, (e) => e.published_at),
    [events],
  )

  const trend = useMemo(() => {
    function split(arr: number[]) {
      const half = Math.floor(arr.length / 2)
      const prior = arr.slice(0, half).reduce((a, b) => a + b, 0)
      const recent = arr.slice(half).reduce((a, b) => a + b, 0)
      return { prior, recent }
    }
    const c = split(created14)
    const p = split(published14)
    // Expected attendees delta: total added by events whose published_at falls
    // in the recent half vs the prior half.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const halfStart = new Date(today)
    halfStart.setDate(today.getDate() - 7)
    const fourteenStart = new Date(today)
    fourteenStart.setDate(today.getDate() - 14)
    let expRecent = 0
    let expPrior = 0
    for (const e of events) {
      if (!e.published_at) continue
      const d = new Date(e.published_at)
      d.setHours(0, 0, 0, 0)
      const attend = e.expected_attendees ?? 0
      if (d >= halfStart && d <= today) expRecent += attend
      else if (d >= fourteenStart && d < halfStart) expPrior += attend
    }
    return {
      created: c,
      publishedDelta: p,
      expected: { recent: expRecent, prior: expPrior },
    }
  }, [created14, published14, events])

  // Top-performing leaderboard: highest expected_attendees among published.
  const topEvents = useMemo(
    () =>
      [...published]
        .sort((a, b) => (b.expected_attendees ?? 0) - (a.expected_attendees ?? 0))
        .slice(0, 5),
    [published],
  )

  // Recent activity feed: last 6 state changes by updated_at desc.
  type ActivityKind = 'created' | 'published' | 'updated'
  const activity = useMemo(() => {
    type Entry = { id: string; title: string; kind: ActivityKind; at: string; slug: string }
    const entries: Entry[] = []
    for (const e of events) {
      entries.push({ id: `c-${e.id}`, title: e.title, kind: 'created', at: e.created_at, slug: e.slug })
      if (e.published_at) {
        entries.push({ id: `p-${e.id}`, title: e.title, kind: 'published', at: e.published_at, slug: e.slug })
      }
    }
    return entries.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6)
  }, [events])

  // Next-event pinned card.
  const nextEventInfo = useMemo(() => {
    const today = todayIso()
    let bestEvent: OrganizerEvent | null = null
    let bestDate: string | null = null
    for (const e of upcoming) {
      const d = nextOccurrence(e, today)
      if (!d) continue
      if (!bestDate || d < bestDate) {
        bestDate = d
        bestEvent = e
      }
    }
    if (!bestEvent || !bestDate) return null
    const todayD = new Date(`${today}T00:00:00`)
    const targetD = new Date(`${bestDate}T00:00:00`)
    const daysUntil = Math.round(
      (targetD.getTime() - todayD.getTime()) / 86_400_000,
    )
    return { event: bestEvent, date: bestDate, daysUntil }
  }, [upcoming])

  const counts = {
    draft: events.filter((e) => e.status === 'draft').length,
    pending_review: events.filter((e) => e.status === 'pending_review').length,
    published: published.length,
    rejected: events.filter((e) => e.status === 'rejected').length,
  }

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-4 pb-16 pt-24 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Building2 className="h-5 w-5 text-flame-400" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold sm:text-3xl">
                  {organizer.display_name}
                </h1>
                <p className="mt-0.5 truncate text-sm text-white/45">
                  {organizer.contact_email}
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              <Link
                href="/organizer/verification"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                {organizer.verification_tier === 'verified' ? (
                  <BadgeCheck className="h-4 w-4 text-flame-400" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {organizer.verification_tier === 'verified'
                    ? 'Verified'
                    : organizer.verification_tier === 'established'
                      ? 'Established'
                      : 'Get verified'}
                </span>
              </Link>
              <Link
                href="/organizer/create"
                className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] transition hover:bg-flame-400"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create event</span>
              </Link>
            </div>
          </div>

          {/* HERO — display-weight expected number */}
          <section className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-flame-500/[0.08] via-white/[0.02] to-transparent p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-flame-300">
                  Audience this run
                </p>
                <p className="mt-3 font-display text-6xl leading-none tracking-tight text-white sm:text-7xl">
                  {formatNumberCompact(audience.expected)}
                </p>
                <p className="mt-3 text-sm text-white/55">
                  {audience.expected === 0 ? (
                    'No expected attendance set yet'
                  ) : (
                    <>
                      across{' '}
                      <span className="font-semibold text-white/85">
                        {audience.cities} {audience.cities === 1 ? 'city' : 'cities'}
                      </span>{' '}
                      ·{' '}
                      <span className="font-semibold text-white/85">
                        {audience.countries} {audience.countries === 1 ? 'country' : 'countries'}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <TrendBadge
                  current={trend.expected.recent}
                  previous={trend.expected.prior}
                  label="last 7 days"
                />
                <Sparkline
                  values={created14}
                  width={140}
                  height={36}
                  color="rgba(238,28,37,0.55)"
                />
              </div>
            </div>
          </section>

          {/* KPI row with sparklines */}
          <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <Calendar className="h-4 w-4 text-flame-300" />
                <TrendBadge
                  current={trend.created.recent}
                  previous={trend.created.prior}
                  asAbsolute
                />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {events.length}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">Total events</p>
              <div className="mt-2">
                <Sparkline values={created14} width={120} height={22} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <CheckCircle2 className="h-4 w-4 text-flame-300" />
                <TrendBadge
                  current={trend.publishedDelta.recent}
                  previous={trend.publishedDelta.prior}
                  asAbsolute
                />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {counts.published}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">Published</p>
              <div className="mt-2">
                <Sparkline values={published14} width={120} height={22} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <MapPin className="h-4 w-4 text-flame-300" />
                <span className="text-[11px] text-white/35">reach</span>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {audience.cities}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">
                {audience.cities === 1 ? 'City' : 'Cities'}
              </p>
              <div className="mt-2 flex items-center gap-1">
                <Globe className="h-3 w-3 text-white/35" />
                <span className="text-[11px] text-white/45">
                  {audience.countries} {audience.countries === 1 ? 'country' : 'countries'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <Clock className="h-4 w-4 text-amber-300" />
                <span className="text-[11px] text-white/35">need action</span>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {counts.pending_review + counts.draft + counts.rejected}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">In progress</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
                {counts.draft > 0 && (
                  <span className="text-white/55">{counts.draft} draft</span>
                )}
                {counts.pending_review > 0 && (
                  <span className="text-amber-300">{counts.pending_review} pending</span>
                )}
                {counts.rejected > 0 && (
                  <span className="text-red-300">{counts.rejected} rejected</span>
                )}
                {counts.draft + counts.pending_review + counts.rejected === 0 && (
                  <span className="text-white/35">All clear</span>
                )}
              </div>
            </div>
          </section>

          {/* Verification progress */}
          {organizer.verification_tier === 'unverified' && (
            <Link
              href="/organizer/verification"
              className="group mt-6 block rounded-3xl border border-flame-500/20 bg-flame-500/[0.06] p-5 transition hover:border-flame-500/30 hover:bg-flame-500/[0.08]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-flame-500/20 bg-flame-500/10">
                    <Sparkles className="h-5 w-5 text-flame-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {counts.published >= ESTABLISHED_THRESHOLD
                        ? 'Ready for the Established tier'
                        : `${counts.published} of ${ESTABLISHED_THRESHOLD} published events to reach Established`}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      Established organizers publish instantly without admin review.
                    </p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 flex-shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-flame-500 transition-all"
                  style={{
                    width: `${Math.min(100, (counts.published / ESTABLISHED_THRESHOLD) * 100)}%`,
                  }}
                />
              </div>
            </Link>
          )}

          {/* Next event */}
          {nextEventInfo && (
            <div className="mt-6 rounded-3xl border border-flame-500/25 bg-gradient-to-br from-flame-500/[0.08] to-transparent p-5">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-flame-300">
                <Flame className="h-3.5 w-3.5" />
                Next event
                <span className="ml-auto text-white/55">
                  {nextEventInfo.daysUntil === 0
                    ? 'Today'
                    : nextEventInfo.daysUntil === 1
                      ? 'Tomorrow'
                      : `in ${nextEventInfo.daysUntil} days`}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-white">
                    {nextEventInfo.event.title}
                  </h2>
                  <p className="mt-1 text-sm text-white/65">
                    {formatEventDateLabel(nextEventInfo.date)}
                    {nextEventInfo.event.time
                      ? ` · ${formatEventTimeLabel(nextEventInfo.event.time)}`
                      : ''}
                  </p>
                </div>
                <Link
                  href={`/events/${nextEventInfo.event.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/15 px-4 py-2 text-xs font-semibold text-flame-100 transition hover:bg-flame-500/25"
                >
                  Open event
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Top performing + Recent activity, side by side on desktop */}
          <div className="mt-10 grid gap-6 lg:grid-cols-5">
            {/* Top performing — 3/5 */}
            <section className="lg:col-span-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Top events
                </h2>
                <span className="text-xs text-white/35">by expected attendance</span>
              </div>
              {topEvents.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/55">
                  Publish an event with an expected-attendance estimate to see your top performers here.
                </div>
              ) : (
                <ol className="mt-4 space-y-2">
                  {topEvents.map((e, i) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-flame-500/15 text-xs font-bold text-flame-300 tabular-nums">
                        {i + 1}
                      </span>
                      {e.banner_url ? (
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                          <Image
                            src={e.banner_url}
                            alt={e.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02]">
                          <Calendar className="h-4 w-4 text-white/30" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {e.title}
                        </p>
                        <p className="truncate text-[11px] text-white/45">
                          {e.location_slug}
                          {e.country ? ` · ${e.country}` : ''}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-sm font-bold tabular-nums text-flame-300">
                        {formatNumberCompact(e.expected_attendees ?? 0)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Recent activity — 2/5 */}
            <section className="lg:col-span-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Recent activity
              </h2>
              {activity.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/55">
                  Nothing yet.
                </div>
              ) : (
                <ul className="mt-4 space-y-1.5">
                  {activity.map((a) => {
                    const when = new Date(a.at)
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const dayDiff = Math.round(
                      (today.getTime() - when.setHours(0, 0, 0, 0)) / 86_400_000,
                    )
                    const whenLabel =
                      dayDiff === 0
                        ? 'Today'
                        : dayDiff === 1
                          ? 'Yesterday'
                          : dayDiff < 7
                            ? `${dayDiff}d ago`
                            : new Date(a.at).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })
                    return (
                      <li
                        key={a.id}
                        className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                      >
                        <span
                          className={[
                            'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                            a.kind === 'published'
                              ? 'bg-flame-400'
                              : a.kind === 'created'
                                ? 'bg-white/40'
                                : 'bg-amber-400',
                          ].join(' ')}
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/events/${a.slug}`}
                            className="block truncate text-xs font-semibold text-white hover:text-flame-200"
                          >
                            {a.title}
                          </Link>
                          <p className="text-[11px] text-white/45">
                            {a.kind === 'published' ? 'Published' : 'Created'} · {whenLabel}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Events lists */}
          <section className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Upcoming events
              </h2>
              <span className="text-xs text-white/35">{upcoming.length}</span>
            </div>

            {upcoming.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <Calendar className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-4 font-semibold text-white">No upcoming events</p>
                <p className="mt-1 text-sm text-white/50">
                  {events.length === 0
                    ? 'Create your first event and submit it for review.'
                    : 'Your active events have all wrapped up. Create a new one or repost a past event.'}
                </p>
                <Link
                  href="/organizer/create"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-flame-400"
                >
                  <Plus className="h-4 w-4" />
                  Create event
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {upcoming.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    organizer={organizer}
                    canRepost={canRepost}
                    studioAccess={studioAccess}
                  />
                ))}
              </div>
            )}
          </section>

          {inFlight.length > 0 && (
            <section className="mt-10">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  In progress
                </h2>
                <span className="text-xs text-white/35">{inFlight.length}</span>
              </div>
              <div className="mt-4 space-y-3">
                {inFlight.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    organizer={organizer}
                    canRepost={canRepost}
                    studioAccess={studioAccess}
                  />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-10">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Past
                </h2>
                <span className="text-xs text-white/35">{past.length}</span>
              </div>
              <div className="mt-4 space-y-3">
                {past.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    organizer={organizer}
                    canRepost={canRepost}
                    studioAccess={studioAccess}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Status reference, demoted from headline tile to bottom legend */}
          <section className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Status breakdown
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Drafts', value: counts.draft, icon: FileText, color: 'text-white/65' },
                { label: 'Pending', value: counts.pending_review, icon: Clock, color: counts.pending_review > 0 ? 'text-amber-300' : 'text-white/65' },
                { label: 'Published', value: counts.published, icon: CheckCircle2, color: 'text-flame-300' },
                { label: 'Rejected', value: counts.rejected, icon: XCircle, color: counts.rejected > 0 ? 'text-red-300' : 'text-white/65' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <Icon className={`h-4 w-4 ${color}`} />
                  <div>
                    <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
