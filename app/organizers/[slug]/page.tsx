import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Calendar,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Repeat,
  User2,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'
import {
  isRecurring,
  nextOccurrenceLabel,
  recurrenceLabel,
} from '@/lib/recurrence'
import { getLocationBySlug } from '@/lib/locations'
import { formatEventTimeLabel } from '@/lib/dateFilters'

type Params = { slug: string }

type OrganizerRecord = {
  id: string
  slug: string
  display_name: string
  bio: string | null
  contact_email: string
  website_url: string | null
  verification_tier: 'unverified' | 'established' | 'verified'
  created_at: string
}

type OrganizerEventRow = {
  id: string
  slug: string
  title: string
  category: string
  date: string
  time: string
  end_time: string | null
  location_slug: string
  country: string | null
  highlight: boolean | null
  is_civic: boolean | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
}

function getCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'
  const value = category.toLowerCase()
  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  if (value === 'civic') return 'bg-flame-500/20 text-flame-300'
  return 'bg-white/10 text-white/80'
}

function titleizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function cityLabel(slug: string): string {
  const known = getLocationBySlug(slug)
  if (known.slug === slug) return known.label
  return titleizeSlug(slug)
}

function formatDateShort(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatJoinedDate(ts: string) {
  const date = new Date(ts)
  return date.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

async function fetchOrganizer(slug: string): Promise<OrganizerRecord | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizers')
    .select(
      'id, slug, display_name, bio, contact_email, website_url, verification_tier, created_at',
    )
    .eq('slug', slug)
    .maybeSingle()
  return (data as OrganizerRecord | null) ?? null
}

async function fetchOrganizerEvents(
  organizerId: string,
): Promise<{ upcoming: OrganizerEventRow[]; totalPublished: number }> {
  const supabase = await createClient()

  const [eventsRes, countRes] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id, slug, title, category, date, time, end_time, location_slug, country, highlight, is_civic, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
      )
      .eq('status', 'published')
      .eq('organizer_id', organizerId)
      .or(activeEventsOrFilter())
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(24),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('organizer_id', organizerId),
  ])

  const upcoming = (eventsRes.data ?? []).filter(isEventActive) as OrganizerEventRow[]
  return { upcoming, totalPublished: countRes.count ?? 0 }
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { slug } = await params
  const organizer = await fetchOrganizer(slug)
  if (!organizer) return { title: 'Organizer not found — AlbaGo' }
  const description =
    organizer.bio?.slice(0, 160) ??
    `Events organized by ${organizer.display_name} on AlbaGo.`
  return {
    title: `${organizer.display_name} — AlbaGo`,
    description,
    openGraph: {
      title: organizer.display_name,
      description,
      type: 'profile',
    },
  }
}

export default async function OrganizerProfilePage(
  { params }: { params: Promise<Params> },
) {
  const { slug } = await params
  const organizer = await fetchOrganizer(slug)
  if (!organizer) notFound()

  const { upcoming, totalPublished } = await fetchOrganizerEvents(organizer.id)
  const isVerified = organizer.verification_tier === 'verified'

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-12 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-flame-500/15 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to events
          </Link>

          <div className="mt-8 flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-flame-500/30 bg-flame-500/10 text-flame-300">
              <User2 className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="display-text text-4xl leading-tight tracking-tight sm:text-5xl">
                  {organizer.display_name}
                </h1>
                {isVerified && (
                  <span
                    title="Verified organizer — identity confirmed by AlbaGo"
                    className="inline-flex items-center gap-1 rounded-full border border-flame-500/30 bg-flame-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-flame-300"
                  >
                    <BadgeCheck className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-white/55">
                On AlbaGo since {formatJoinedDate(organizer.created_at)}
              </p>
            </div>
          </div>

          {organizer.bio && (
            <p className="mt-6 whitespace-pre-line text-base leading-7 text-white/75">
              {organizer.bio}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Events on AlbaGo
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {totalPublished}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Upcoming
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {upcoming.length}
              </p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Trust tier
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-white">
                {organizer.verification_tier}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {organizer.website_url && (
              <a
                href={organizer.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Website
              </a>
            )}
            <a
              href={`mailto:${organizer.contact_email}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Mail className="h-3.5 w-3.5" />
              {organizer.contact_email}
            </a>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Upcoming events
          </h2>

          {upcoming.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center backdrop-blur-md">
              <p className="text-base font-semibold text-white">
                No upcoming events
              </p>
              <p className="mt-2 text-sm text-white/55">
                Check back soon — {organizer.display_name} hasn&apos;t posted
                anything new yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {upcoming.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="group block rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition hover:border-flame-500/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${getCategoryTone(
                        event.category,
                      )}`}
                    >
                      {event.category}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70">
                      {isRecurring(event)
                        ? nextOccurrenceLabel(event) ??
                          formatDateShort(event.date)
                        : formatDateShort(event.date)}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold leading-snug text-white">
                    {event.title}
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/55">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDateShort(event.date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatEventTimeLabel(event.time)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {cityLabel(event.location_slug)}
                    </span>
                    {isRecurring(event) && (
                      <span className="inline-flex items-center gap-1.5 text-flame-300">
                        <Repeat className="h-3.5 w-3.5" />
                        {recurrenceLabel(event)}
                      </span>
                    )}
                  </div>

                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-flame-400 transition group-hover:text-flame-300">
                    View event
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
