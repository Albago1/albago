'use client'

import { useMemo, useState } from 'react'
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
  Users,
  XCircle,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import ShareModal from '@/components/share/ShareModal'
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

type EventRowProps = {
  event: OrganizerEvent
  organizer: Organizer
  canRepost: boolean
}

function EventRow({ event, organizer, canRepost }: EventRowProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const repostable = canRepost && isRepostable(event)
  const isPublishedAndEditable = event.status === 'draft' || event.status === 'rejected'

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-start sm:p-5">
      {event.banner_url ? (
        <div className="relative h-24 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:h-20 sm:w-32 sm:flex-shrink-0">
          <Image
            src={event.banner_url}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 100vw, 128px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="hidden h-20 w-32 flex-shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] sm:flex">
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
          <div className="mt-3 rounded-2xl border border-red-500/15 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            <span className="font-semibold">Feedback: </span>
            {event.admin_note}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {event.status === 'published' && (
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </Link>
          )}
          {isPublishedAndEditable && (
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
        />
      )}
    </div>
  )
}

export default function OrganizerDashboardClient({
  organizer,
  events,
}: {
  organizer: Organizer
  events: OrganizerEvent[]
}) {
  const canRepost = organizer.verification_tier === 'verified'

  // Pre-compute everything once. Server-fetched events are ordered by
  // created_at desc; we want chronological by event date for upcoming.
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
        (e) => e.status === 'draft' || e.status === 'pending_review' || e.status === 'rejected',
      ),
    [events],
  )

  const counts = {
    draft: events.filter((e) => e.status === 'draft').length,
    pending_review: events.filter((e) => e.status === 'pending_review').length,
    published: events.filter((e) => e.status === 'published').length,
    rejected: events.filter((e) => e.status === 'rejected').length,
  }

  // Audience: aggregate every published event into a one-line story
  const audience = useMemo(() => {
    const published = events.filter((e) => e.status === 'published')
    const expected = published.reduce(
      (sum, e) => sum + (e.expected_attendees ?? 0),
      0,
    )
    const cities = new Set(published.map((e) => e.location_slug).filter(Boolean))
      .size
    const countries = new Set(published.map((e) => e.country).filter(Boolean))
      .size
    return { expected, cities, countries, total: published.length }
  }, [events])

  // "Next event" — the upcoming one closest to today. Respect recurrence so
  // a daily series counted as today/tomorrow shows correctly.
  const nextEventInfo = useMemo(() => {
    const today = todayIso()
    let bestEvent: OrganizerEvent | null = null
    let bestDate: string | null = null
    for (const e of upcoming) {
      const nextDate = nextOccurrence(e, today)
      if (!nextDate) continue
      if (!bestDate || nextDate < bestDate) {
        bestDate = nextDate
        bestEvent = e
      }
    }
    if (!bestEvent || !bestDate) return null
    const todayD = new Date(`${today}T00:00:00`)
    const targetD = new Date(`${bestDate}T00:00:00`)
    const daysUntil = Math.round(
      (targetD.getTime() - todayD.getTime()) / (24 * 60 * 60 * 1000),
    )
    return { event: bestEvent, date: bestDate, daysUntil }
  }, [upcoming])

  const statusCounts = [
    {
      label: 'Drafts',
      value: counts.draft,
      icon: FileText,
      active: counts.draft > 0,
      activeBg: 'bg-white/[0.06] border-white/15',
    },
    {
      label: 'Pending',
      value: counts.pending_review,
      icon: Clock,
      active: counts.pending_review > 0,
      activeBg: 'bg-amber-500/[0.07] border-amber-500/15',
      activeColor: 'text-amber-400',
    },
    {
      label: 'Published',
      value: counts.published,
      icon: CheckCircle2,
      active: counts.published > 0,
      activeBg: 'bg-flame-500/[0.07] border-flame-500/15',
      activeColor: 'text-flame-400',
    },
    {
      label: 'Rejected',
      value: counts.rejected,
      icon: XCircle,
      active: counts.rejected > 0,
      activeBg: 'bg-red-500/[0.07] border-red-500/15',
      activeColor: 'text-red-400',
    },
  ]

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-16 pt-24 text-white">
        <div className="mx-auto max-w-3xl">
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

          {/* Audience strip — the headline number for an organizer */}
          {audience.total > 0 && (
            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-3xl border border-flame-500/25 bg-flame-500/[0.06] p-4 sm:p-5">
                <Users className="h-5 w-5 text-flame-300" />
                <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  {formatNumberCompact(audience.expected)}
                </div>
                <div className="mt-1 text-[11px] text-white/55 sm:text-xs">
                  People expected
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <MapPin className="h-5 w-5 text-flame-300" />
                <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  {audience.cities}
                </div>
                <div className="mt-1 text-[11px] text-white/55 sm:text-xs">
                  {audience.cities === 1 ? 'City' : 'Cities'}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <Globe className="h-5 w-5 text-flame-300" />
                <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  {audience.countries}
                </div>
                <div className="mt-1 text-[11px] text-white/55 sm:text-xs">
                  {audience.countries === 1 ? 'Country' : 'Countries'}
                </div>
              </div>
            </div>
          )}

          {/* Verification progress — what's the next tier and how close */}
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
                      Established organizers publish instantly without admin
                      review. Apply for the Verified badge for public trust.
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

          {/* Next event pinned card */}
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

          {/* Status counts (drafts / pending / published / rejected) */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statusCounts.map(({ label, value, icon: Icon, active, activeBg, activeColor }) => (
              <div
                key={label}
                className={`rounded-3xl border p-4 ${
                  active && activeBg ? activeBg : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? activeColor ?? 'text-white' : 'text-white/55'}`}
                />
                <div
                  className={`mt-3 text-3xl font-bold ${active ? activeColor ?? 'text-white' : 'text-white/65'}`}
                >
                  {value}
                </div>
                <div className="mt-1 text-xs text-white/45">{label}</div>
              </div>
            ))}
          </div>

          {/* Upcoming events */}
          <section id="upcoming-events" className="mt-10">
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
                  />
                ))}
              </div>
            )}
          </section>

          {/* In-flight (drafts, pending, rejected) */}
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
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past */}
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
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
