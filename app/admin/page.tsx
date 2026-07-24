import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CalendarCheck,
  Clock,
  Globe,
  HandHeart,
  Inbox,
  MapPin,
  Megaphone,
  Send,
  TrendingUp,
  Users as UsersIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Sparkline from '@/components/dashboard/Sparkline'
import TrendBadge from '@/components/dashboard/TrendBadge'

export const metadata: Metadata = {
  title: 'Admin · AlbaGo',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

type CountResult = { count: number | null; error: { message: string } | null }
function safeCount(res: CountResult | null | undefined): number {
  if (!res || res.error) return 0
  return res.count ?? 0
}

function bucketDatesByDay(dates: string[], daysBack: number): number[] {
  const buckets = Array.from({ length: daysBack }, () => 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const raw of dates) {
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

function splitTrend(arr: number[]) {
  const half = Math.floor(arr.length / 2)
  return {
    prior: arr.slice(0, half).reduce((a, b) => a + b, 0),
    recent: arr.slice(half).reduce((a, b) => a + b, 0),
  }
}

function relativeDay(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  d.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatNumberCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export default async function AdminHomePage() {
  const supabase = await createClient()
  const today = new Date()
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 86_400_000).toISOString()

  // Counts (head-only, no row payload) + sparkline source data + recent
  // activity, all in parallel.
  const [
    publishedEvents,
    upcomingEvents,
    pendingSubmissions,
    pendingOrganizers,
    newVolunteers,
    totalUsers,
    eventsTimeline,
    profilesTimeline,
    recentSubmissions,
    recentOrganizerApps,
    publishedEventsList,
  ] = await Promise.all([
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .or(`date.gte.${todayIso},recurrence.in.(daily,weekly)`),
    supabase
      .from('event_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('organizers')
      .select('id', { count: 'exact', head: true })
      .eq('id_review_status', 'pending'),
    supabase
      .from('volunteer_signups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('events')
      .select('created_at')
      .gte('created_at', fourteenDaysAgo),
    supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', fourteenDaysAgo),
    supabase
      .from('event_submissions')
      .select('id, title, created_at, status')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('organizers')
      .select('id, display_name, created_at, id_review_status')
      .eq('id_review_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('events')
      .select('location_slug, country, expected_attendees')
      .eq('status', 'published'),
  ])

  const counts = {
    publishedEvents: safeCount(publishedEvents),
    upcomingEvents: safeCount(upcomingEvents),
    pendingSubmissions: safeCount(pendingSubmissions),
    pendingOrganizers: safeCount(pendingOrganizers),
    newVolunteers: safeCount(newVolunteers),
    totalUsers: safeCount(totalUsers),
  }

  const totalPending =
    counts.pendingSubmissions +
    counts.pendingOrganizers +
    counts.newVolunteers

  const eventsSpark = bucketDatesByDay(
    ((eventsTimeline.data as Array<{ created_at: string }> | null) ?? []).map(
      (r) => r.created_at,
    ),
    14,
  )
  const usersSpark = bucketDatesByDay(
    ((profilesTimeline.data as Array<{ created_at: string }> | null) ?? []).map(
      (r) => r.created_at,
    ),
    14,
  )
  const eventsTrend = splitTrend(eventsSpark)
  const usersTrend = splitTrend(usersSpark)

  // Aggregate platform reach from the published events list
  type PubEventRow = {
    location_slug: string | null
    country: string | null
    expected_attendees: number | null
  }
  const pubEvents = (publishedEventsList.data as PubEventRow[] | null) ?? []
  const totalExpected = pubEvents.reduce(
    (s, e) => s + (e.expected_attendees ?? 0),
    0,
  )
  const distinctCities = new Set(
    pubEvents.map((e) => e.location_slug).filter(Boolean),
  ).size
  const distinctCountries = new Set(
    pubEvents.map((e) => e.country).filter(Boolean),
  ).size

  // Top cities by event count
  const cityMap = new Map<string, { country: string; count: number; expected: number }>()
  for (const e of pubEvents) {
    const key = e.location_slug ?? ''
    if (!key) continue
    const existing = cityMap.get(key)
    if (existing) {
      existing.count += 1
      existing.expected += e.expected_attendees ?? 0
    } else {
      cityMap.set(key, {
        country: e.country ?? '',
        count: 1,
        expected: e.expected_attendees ?? 0,
      })
    }
  }
  const topCities = Array.from(cityMap.entries())
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.count - a.count || b.expected - a.expected)
    .slice(0, 5)

  // Recent activity: merge submissions, organizer applications
  type Activity =
    | { kind: 'submission'; id: string; title: string; at: string; status: string }
    | { kind: 'organizer'; id: string; title: string; at: string }
  const acts: Activity[] = []
  for (const s of (recentSubmissions.data ?? []) as Array<{
    id: string
    title: string
    created_at: string
    status: string
  }>) {
    acts.push({
      kind: 'submission',
      id: `s-${s.id}`,
      title: s.title,
      at: s.created_at,
      status: s.status,
    })
  }
  for (const o of (recentOrganizerApps.data ?? []) as Array<{
    id: string
    display_name: string
    created_at: string
  }>) {
    acts.push({
      kind: 'organizer',
      id: `o-${o.id}`,
      title: o.display_name || 'Organizer application',
      at: o.created_at,
    })
  }
  acts.sort((a, b) => (a.at < b.at ? 1 : -1))
  const recent = acts.slice(0, 8)

  type Tile = {
    href: string
    title: string
    icon: typeof Inbox
    pending?: number
    pendingLabel?: string
  }

  const tiles: Tile[] = [
    { href: '/admin/queue', title: 'Moderation queue', icon: Inbox, pending: counts.pendingSubmissions, pendingLabel: 'pending' },
    { href: '/admin/organizers', title: 'Organizers', icon: BadgeCheck, pending: counts.pendingOrganizers, pendingLabel: 'awaiting review' },
    { href: '/admin/volunteers', title: 'Volunteers', icon: HandHeart, pending: counts.newVolunteers, pendingLabel: 'new' },
    { href: '/admin/events', title: 'Events', icon: Megaphone },
    { href: '/admin/users', title: 'Users', icon: UsersIcon },
    { href: '/admin/share-batch', title: 'Share batch', icon: Send },
  ]

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Tight top action — single CTA, no duplicate page title (shell top bar shows "Overview") */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-flame-300">
              Platform health
            </p>
            <p className="mt-1 text-xs text-white/45">
              Live counts, top cities, recent activity
            </p>
          </div>
          <Link
            href="/admin/queue"
            className={[
              'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition',
              totalPending > 0
                ? 'bg-flame-500 text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] hover:bg-flame-400'
                : 'border border-white/15 bg-white/[0.04] text-white/85 hover:bg-white/[0.08] hover:text-white',
            ].join(' ')}
          >
            <Inbox className="h-3.5 w-3.5" />
            {totalPending > 0
              ? `${totalPending} awaiting action`
              : 'Open queue'}
          </Link>
        </div>

        {/* HERO — total expected attendance across the platform */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-flame-500/[0.08] via-white/[0.02] to-transparent p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-flame-300">
                  Platform reach
                </p>
                <p className="mt-3 font-display text-6xl leading-none tracking-tight text-white sm:text-7xl">
                  {formatNumberCompact(totalExpected)}
                </p>
                <p className="mt-3 text-sm text-white/55">
                  expected attendance across{' '}
                  <span className="font-semibold text-white/85">
                    {counts.publishedEvents}
                  </span>{' '}
                  published events ·{' '}
                  <span className="font-semibold text-white/85">
                    {distinctCities}
                  </span>{' '}
                  {distinctCities === 1 ? 'city' : 'cities'} ·{' '}
                  <span className="font-semibold text-white/85">
                    {distinctCountries}
                  </span>{' '}
                  {distinctCountries === 1 ? 'country' : 'countries'}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <TrendBadge
                  current={eventsTrend.recent}
                  previous={eventsTrend.prior}
                  asAbsolute
                  label="events created last 7d"
                />
                <Sparkline values={eventsSpark} width={140} height={36} />
              </div>
            </div>
          </section>

          {/* KPI row with sparklines */}
          <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <Calendar className="h-4 w-4 text-flame-300" />
                <TrendBadge
                  current={eventsTrend.recent}
                  previous={eventsTrend.prior}
                  asAbsolute
                />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {counts.publishedEvents}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">Published</p>
              <div className="mt-2">
                <Sparkline values={eventsSpark} width={120} height={22} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <CalendarCheck className="h-4 w-4 text-flame-300" />
                <span className="text-[11px] text-white/35">live</span>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {counts.upcomingEvents}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">Upcoming</p>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-white/40">
                {counts.publishedEvents - counts.upcomingEvents} past
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <UsersIcon className="h-4 w-4 text-flame-300" />
                <TrendBadge
                  current={usersTrend.recent}
                  previous={usersTrend.prior}
                  asAbsolute
                />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {counts.totalUsers}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">Users</p>
              <div className="mt-2">
                <Sparkline values={usersSpark} width={120} height={22} />
              </div>
            </div>

            <div
              className={[
                'rounded-2xl border p-4',
                totalPending > 0
                  ? 'border-amber-500/30 bg-amber-500/[0.06]'
                  : 'border-white/10 bg-white/[0.03]',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <Clock
                  className={`h-4 w-4 ${totalPending > 0 ? 'text-amber-300' : 'text-white/55'}`}
                />
                <span className="text-[11px] text-white/35">queue</span>
              </div>
              <p
                className={`mt-3 text-2xl font-bold tabular-nums ${totalPending > 0 ? 'text-amber-300' : 'text-white'}`}
              >
                {totalPending}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">Awaiting action</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide">
                {counts.pendingSubmissions > 0 && (
                  <span className="text-white/55">
                    {counts.pendingSubmissions} sub
                  </span>
                )}
                {counts.pendingOrganizers > 0 && (
                  <span className="text-white/55">
                    {counts.pendingOrganizers} org
                  </span>
                )}
                {counts.newVolunteers > 0 && (
                  <span className="text-white/55">
                    {counts.newVolunteers} vol
                  </span>
                )}
                {totalPending === 0 && (
                  <span className="text-white/35">All clear</span>
                )}
              </div>
            </div>
          </section>

          {/* Top cities + Recent activity */}
          <div className="mt-10 grid gap-6 lg:grid-cols-5">
            <section className="lg:col-span-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Top cities
                </h2>
                <span className="text-xs text-white/35">
                  by published events
                </span>
              </div>
              {topCities.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/55">
                  No published events with city data yet.
                </div>
              ) : (
                <ol className="mt-4 space-y-2">
                  {topCities.map((c, i) => (
                    <li
                      key={c.slug}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-flame-500/15 text-xs font-bold tabular-nums text-flame-300">
                        {i + 1}
                      </span>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02]">
                        <MapPin className="h-4 w-4 text-white/40" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold capitalize text-white">
                          {c.slug.replace(/-/g, ' ')}
                        </p>
                        <p className="truncate text-[11px] text-white/45">
                          {c.country || '—'}
                          {c.expected > 0 && (
                            <>
                              {' · '}
                              {formatNumberCompact(c.expected)} expected
                            </>
                          )}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-sm font-bold tabular-nums text-flame-300">
                        {c.count}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="lg:col-span-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Recent activity
              </h2>
              {recent.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/55">
                  Nothing yet.
                </div>
              ) : (
                <ul className="mt-4 space-y-1.5">
                  {recent.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <span
                        className={[
                          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                          a.kind === 'organizer'
                            ? 'bg-flame-500/10 text-flame-300'
                            : 'bg-white/[0.06] text-white/70',
                        ].join(' ')}
                      >
                        {a.kind === 'organizer' ? (
                          <BadgeCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={
                            a.kind === 'organizer'
                              ? '/admin/organizers'
                              : '/admin/queue'
                          }
                          className="block truncate text-xs font-semibold text-white hover:text-flame-200"
                        >
                          {a.title}
                        </Link>
                        <p className="text-[11px] text-white/45 capitalize">
                          {a.kind === 'organizer'
                            ? 'Organizer application'
                            : `Submission · ${a.status}`}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-[11px] text-white/45">
                        {relativeDay(a.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Tile grid — demoted, just navigation */}
          <section className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              All areas
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {tiles.map((tile) => {
                const Icon = tile.icon
                const hasPending = (tile.pending ?? 0) > 0
                return (
                  <Link
                    key={tile.href}
                    href={tile.href}
                    className={[
                      'group flex items-center justify-between rounded-2xl border px-4 py-3 transition',
                      hasPending
                        ? 'border-amber-500/25 bg-amber-500/[0.06] hover:border-amber-500/40 hover:bg-amber-500/[0.10]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 ${hasPending ? 'text-amber-300' : 'text-flame-300'}`}
                      />
                      <span className="text-sm font-semibold text-white">
                        {tile.title}
                      </span>
                      {hasPending && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          <Clock className="h-2.5 w-2.5" />
                          {tile.pending} {tile.pendingLabel}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
                  </Link>
                )
              })}
            </div>
          </section>

        {/* Reach mini-legend */}
        {distinctCountries > 0 && (
          <div className="mt-8 flex items-center gap-2 text-xs text-white/45">
            <Globe className="h-3.5 w-3.5" />
            Active in {distinctCountries}{' '}
            {distinctCountries === 1 ? 'country' : 'countries'} ·{' '}
            {distinctCities} {distinctCities === 1 ? 'city' : 'cities'}
          </div>
        )}
      </div>
    </div>
  )
}
