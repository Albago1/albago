import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  Compass,
  FileText,
  Heart,
  LayoutDashboard,
  Send,
  Settings,
  Ticket as TicketIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import SavedEventsList, { type SavedEventCard } from '@/components/SavedEventsList'
import DeleteAccountButton from '@/components/dashboard/DeleteAccountButton'
import Sparkline from '@/components/dashboard/Sparkline'
import TrendBadge from '@/components/dashboard/TrendBadge'
import { getLocationBySlug } from '@/lib/locations'
import { fetchOrganizer } from '@/lib/organizers'
import { isEventActive } from '@/lib/eventActive'

function greetingPrefix(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Up late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function firstName(name: string | undefined | null, fallback: string): string {
  if (!name) return fallback
  return name.split(/\s+/)[0] || fallback
}

type SavedEventRow = {
  saved_at: string
  events: {
    id: string
    slug: string
    title: string
    date: string
    end_date: string | null
    time: string
    category: string
    highlight: boolean | null
    price: string | null
    location_slug: string
    places: { name: string } | null
  } | null
}

async function fetchSavedEventCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<SavedEventCard[]> {
  const { data } = await supabase
    .from('saved_events')
    .select(
      'saved_at, events ( id, slug, title, date, end_date, time, category, highlight, price, location_slug, places ( name ) )'
    )
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })

  const rows = (data as SavedEventRow[] | null) ?? []
  return rows
    .filter((row): row is SavedEventRow & { events: NonNullable<SavedEventRow['events']> } => row.events !== null)
    .map((row) => ({
      id: row.events.id,
      slug: row.events.slug,
      title: row.events.title,
      date: row.events.date,
      endDate: row.events.end_date,
      time: row.events.time,
      category: row.events.category,
      highlight: row.events.highlight,
      price: row.events.price,
      location_label: getLocationBySlug(row.events.location_slug).label,
      venue_name: row.events.places?.name ?? null,
      saved_at: row.saved_at,
    }))
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

export const metadata: Metadata = {
  title: 'Dashboard',
}

type Submission = {
  id: string
  title: string
  venue_name: string
  date: string
  status: string
  admin_note: string | null
  created_at: string
}

function statusBadge(status: string) {
  if (status === 'approved')
    return 'border-green-500/20 bg-green-500/10 text-green-400'
  if (status === 'rejected')
    return 'border-red-500/20 bg-red-500/10 text-red-400'
  return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .maybeSingle()

  // Admins go straight to the real control room - no landing page in between.
  if (profile?.role === 'admin') redirect('/admin')

  // — Regular user view —
  const [submissionsRes, savedEvents, organizer, prefsRes, ticketsRes] =
    await Promise.all([
      supabase
        .from('event_submissions')
        .select('id, title, venue_name, date, status, admin_note, created_at')
        .eq('submitted_by_user_id', user.id)
        .order('created_at', { ascending: false }),
      fetchSavedEventCards(supabase, user.id),
      fetchOrganizer(supabase),
      supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
        .in('status', ['valid', 'checked_in']),
    ])

  const userSubmissions: Submission[] = submissionsRes.data ?? []
  const ticketCount = ticketsRes.count ?? 0

  // Split saved events into Upcoming vs Past so the section reads at a glance
  // instead of mixing tomorrow's protest with last month's gig.
  const upcomingSaved = savedEvents.filter((e) =>
    isEventActive({ date: e.date, time: e.time }),
  )
  const pastSaved = savedEvents.filter(
    (e) => !isEventActive({ date: e.date, time: e.time }),
  )

  const prefs = (prefsRes.data?.notification_preferences ?? {}) as {
    saved_event_updates?: boolean
  }
  const savedEventUpdates = prefs.saved_event_updates !== false

  // 14-day buckets for sparklines on the KPI tiles.
  const savesSpark = bucketDatesByDay(
    savedEvents.map((s) => s.saved_at ?? ''),
    14,
  )
  const submissionsSpark = bucketDatesByDay(
    userSubmissions.map((s) => s.created_at),
    14,
  )

  // Trend = last 7 days vs prior 7. asAbsolute on tiles since user counts
  // are small enough that "+1" reads better than "+100%".
  function splitTrend(arr: number[]) {
    const half = Math.floor(arr.length / 2)
    return {
      prior: arr.slice(0, half).reduce((a, b) => a + b, 0),
      recent: arr.slice(half).reduce((a, b) => a + b, 0),
    }
  }
  const savesTrend = splitTrend(savesSpark)
  const submissionsTrend = splitTrend(submissionsSpark)

  // Recent activity feed: merge saves + submissions by their respective
  // timestamp. Last 6.
  type Activity =
    | { kind: 'save'; id: string; title: string; at: string; href: string }
    | { kind: 'submission'; id: string; title: string; at: string; href: string; status: string }
  const activity: Activity[] = []
  for (const s of savedEvents) {
    if (s.saved_at) {
      activity.push({
        kind: 'save',
        id: `s-${s.id}`,
        title: s.title,
        at: s.saved_at,
        href: `/events/${s.slug}`,
      })
    }
  }
  for (const sub of userSubmissions) {
    activity.push({
      kind: 'submission',
      id: `u-${sub.id}`,
      title: sub.title,
      at: sub.created_at,
      href: '/dashboard#my-submissions',
      status: sub.status,
    })
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1))
  const recentActivity = activity.slice(0, 6)

  const friendlyName = firstName(
    profile?.display_name as string | undefined,
    user.email?.split('@')[0] ?? 'there',
  )

  const heroSubtitle =
    upcomingSaved.length === 0
      ? savedEvents.length === 0
        ? 'No events on your calendar yet'
        : `${pastSaved.length} past · save one for what's coming up`
      : `${upcomingSaved.length === 1 ? 'event' : 'events'} on your calendar · ${pastSaved.length} past`

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-16 pt-24 text-white">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <LayoutDashboard className="h-5 w-5 text-flame-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {greetingPrefix()}, {friendlyName}
                </h1>
                <p className="mt-0.5 text-sm text-white/45">{user.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </div>
          </div>

          {/* HERO — your personal headline number */}
          <section className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-flame-500/[0.08] via-white/[0.02] to-transparent p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-flame-300">
                  Your calendar
                </p>
                <p className="mt-3 font-display text-6xl leading-none tracking-tight text-white sm:text-7xl">
                  {upcomingSaved.length}
                </p>
                <p className="mt-3 text-sm text-white/55">{heroSubtitle}</p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <TrendBadge
                  current={savesTrend.recent}
                  previous={savesTrend.prior}
                  asAbsolute
                  label="saves last 7 days"
                />
                <Sparkline
                  values={savesSpark}
                  width={140}
                  height={36}
                  color="rgba(238,28,37,0.55)"
                />
              </div>
            </div>
          </section>

          {/* KPI row with sparklines */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href="#saved-upcoming"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between">
                <Heart className="h-4 w-4 text-flame-300" />
                <TrendBadge
                  current={savesTrend.recent}
                  previous={savesTrend.prior}
                  asAbsolute
                />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {savedEvents.length}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">Saved events</p>
              <div className="mt-2">
                <Sparkline values={savesSpark} width={120} height={22} />
              </div>
            </a>

            <a
              href="#my-submissions"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between">
                <Send className="h-4 w-4 text-flame-300" />
                <TrendBadge
                  current={submissionsTrend.recent}
                  previous={submissionsTrend.prior}
                  asAbsolute
                />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {userSubmissions.length}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">Submissions</p>
              <div className="mt-2">
                <Sparkline values={submissionsSpark} width={120} height={22} />
              </div>
            </a>
          </div>

          {/* Quick actions */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/submit-event"
              className="group flex items-center gap-3 rounded-2xl border border-flame-500/30 bg-flame-500/[0.08] px-4 py-3 transition hover:border-flame-500/50 hover:bg-flame-500/[0.14]"
            >
              <Send className="h-4 w-4 text-flame-300" />
              <span className="text-sm font-semibold text-white">Submit event</span>
              <ArrowRight className="ml-auto h-4 w-4 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white/85" />
            </Link>
            <Link
              href="/map"
              className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <Compass className="h-4 w-4 text-flame-300" />
              <span className="text-sm font-semibold text-white">Browse map</span>
              <ArrowRight className="ml-auto h-4 w-4 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white/85" />
            </Link>
          </div>

          {/* My Tickets hand-off */}
          <Link
            href="/dashboard/tickets"
            className="group mt-8 flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <TicketIcon className="h-5 w-5 text-flame-400" />
              </div>
              <div>
                <p className="font-semibold text-white">My Tickets</p>
                <p className="mt-0.5 text-sm text-white/50">
                  {ticketCount > 0
                    ? `${ticketCount} ticket${ticketCount === 1 ? '' : 's'} · QR codes ready at the door`
                    : 'Free tickets you claim appear here'}
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
          </Link>

          {/* Organizer hand-off */}
          <Link
            href={organizer ? '/organizer' : '/become-organizer'}
            className="group mt-8 flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Building2 className="h-5 w-5 text-flame-400" />
              </div>
              <div>
                <p className="font-semibold text-white">
                  {organizer ? 'Organizer dashboard' : 'Organise events on AlbaGo'}
                </p>
                <p className="mt-0.5 text-sm text-white/50">
                  {organizer
                    ? 'Manage your events, repost past ones, track verification'
                    : 'Apply for a verified organizer account'}
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
          </Link>

          {/* Recent activity */}
          <div className="mt-10">
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Recent activity
              </h2>
              {recentActivity.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/55">
                  Save an event or submit one — your trail shows up here.
                </div>
              ) : (
                <ul className="mt-4 space-y-1.5">
                  {recentActivity.map((a) => {
                    if (a.kind === 'save') {
                      return (
                        <li
                          key={a.id}
                          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                        >
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-flame-500/10 text-flame-300">
                            <Heart className="h-3.5 w-3.5" />
                          </span>
                          <Link
                            href={a.href}
                            className="min-w-0 flex-1 truncate text-sm font-semibold text-white hover:text-flame-200"
                          >
                            Saved {a.title}
                          </Link>
                          <span className="flex-shrink-0 text-[11px] text-white/45">
                            {relativeDay(a.at)}
                          </span>
                        </li>
                      )
                    }
                    return (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                      >
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
                          <Send className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={a.href}
                            className="block truncate text-sm font-semibold text-white hover:text-flame-200"
                          >
                            Submitted {a.title}
                          </Link>
                          <p className="text-[11px] text-white/45 capitalize">
                            {a.status}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-[11px] text-white/45">
                          {relativeDay(a.at)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Saved — Upcoming */}
          <section id="saved-upcoming" className="mt-10 scroll-mt-24">
            <div className="flex items-end justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                <CalendarClock className="h-3.5 w-3.5" />
                Saved · upcoming
              </h2>
              <span className="text-xs text-white/35">
                {upcomingSaved.length}
              </span>
            </div>
            <SavedEventsList initialEvents={upcomingSaved} />
          </section>

          {/* Saved — Past (only if anything actually past) */}
          {pastSaved.length > 0 && (
            <section className="mt-10">
              <div className="flex items-end justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  <Calendar className="h-3.5 w-3.5" />
                  Saved · past
                </h2>
                <span className="text-xs text-white/35">{pastSaved.length}</span>
              </div>
              <SavedEventsList initialEvents={pastSaved} />
            </section>
          )}

          {/* My submissions */}
          <section id="my-submissions" className="mt-10 scroll-mt-24">
            <div className="flex items-end justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                <FileText className="h-3.5 w-3.5" />
                My submissions
              </h2>
              <span className="text-xs text-white/35">
                {userSubmissions.length}
              </span>
            </div>

            {userSubmissions.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <Send className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-4 font-semibold text-white">No submissions yet</p>
                <p className="mt-1 text-sm text-white/50">
                  Submit an event and track its review status here.
                </p>
                <Link
                  href="/submit-event"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-flame-400"
                >
                  Submit your first event
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {userSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{sub.title}</p>
                        <p className="mt-1 text-sm text-white/50">
                          {sub.venue_name} · {sub.date}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusBadge(sub.status)}`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    {sub.status === 'rejected' && sub.admin_note && (
                      <div className="mt-3 rounded-2xl border border-red-500/15 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                        <span className="font-semibold">Note from team: </span>
                        {sub.admin_note}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-white/30">
                      Submitted {new Date(sub.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Notification preview + account footer */}
          <section className="mt-12 grid gap-4 sm:grid-cols-2">
            <Link
              href="/dashboard/settings"
              className="group flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Bell className="h-5 w-5 text-flame-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Notifications</p>
                  <p className="mt-0.5 text-xs text-white/55">
                    Saved-event updates ·{' '}
                    <span
                      className={
                        savedEventUpdates ? 'text-emerald-300' : 'text-white/50'
                      }
                    >
                      {savedEventUpdates ? 'On' : 'Off'}
                    </span>
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 flex-shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
            </Link>

            <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div>
                <p className="font-semibold text-white">Account</p>
                <p className="mt-0.5 text-xs text-white/55">
                  Delete account and all data
                </p>
              </div>
              <DeleteAccountButton email={user.email ?? ''} />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

