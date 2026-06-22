import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  Camera,
  Clock,
  Compass,
  FileText,
  Heart,
  Image as ImageIcon,
  LayoutDashboard,
  MapPin,
  Send,
  Settings,
  Shield,
  Users as UsersIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import SavedEventsList, { type SavedEventCard } from '@/components/SavedEventsList'
import MyPlacardsList, {
  type MyPlacardCard,
} from '@/components/dashboard/MyPlacardsList'
import DeleteAccountButton from '@/components/dashboard/DeleteAccountButton'
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
      'saved_at, events ( id, slug, title, date, time, category, highlight, price, location_slug, places ( name ) )'
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
      time: row.events.time,
      category: row.events.category,
      highlight: row.events.highlight,
      price: row.events.price,
      location_label: getLocationBySlug(row.events.location_slug).label,
      venue_name: row.events.places?.name ?? null,
    }))
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

  const greetingName = (profile?.display_name as string | undefined) || user.email

  // — Admin view —
  if (profile?.role === 'admin') {
    const [eventsRes, pendingRes, placesRes, savedEvents] = await Promise.all([
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('event_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase.from('places').select('*', { count: 'exact', head: true }),
      fetchSavedEventCards(supabase, user.id),
    ])

    const stats = [
      {
        label: 'Published Events',
        value: eventsRes.count ?? 0,
        icon: Calendar,
        color: 'text-flame-400',
        bg: 'bg-flame-500/10 border-flame-500/30',
      },
      {
        label: 'Pending Review',
        value: pendingRes.count ?? 0,
        icon: Clock,
        color: (pendingRes.count ?? 0) > 0 ? 'text-amber-400' : 'text-white',
        bg:
          (pendingRes.count ?? 0) > 0
            ? 'bg-amber-500/10 border-amber-500/20'
            : 'bg-white/[0.03] border-white/10',
      },
      {
        label: 'Total Places',
        value: placesRes.count ?? 0,
        icon: MapPin,
        color: 'text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/20',
      },
    ]

    return (
      <>
        <LandingNavbar />
        <main className="min-h-screen bg-ink-950 px-6 pb-6 pt-24 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <LayoutDashboard className="h-5 w-5 text-flame-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="mt-0.5 text-sm text-white/45">{greetingName}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
              >
                <Shield className="h-4 w-4" />
                Open admin panel
              </Link>
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                <UsersIcon className="h-4 w-4" />
                Manage users
              </Link>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className={`rounded-3xl border p-6 ${stat.bg}`}
                >
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                  <div className={`mt-4 text-4xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm text-white/55">{stat.label}</div>
                </div>
              )
            })}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href="/admin"
              className="group flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Review Submissions
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  Approve or reject submitted events
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
            </Link>

            <Link
              href="/map"
              className="group flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div>
                <h2 className="text-lg font-semibold text-white">View Map</h2>
                <p className="mt-1 text-sm text-white/50">
                  Browse all venues and events live
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
            </Link>
          </div>

          <div className="mt-10">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              <Heart className="h-3.5 w-3.5" />
              Saved events
            </h2>
            <SavedEventsList initialEvents={savedEvents} />
          </div>
        </div>
      </main>
      </>
    )
  }

  // — Regular user view —
  const [submissionsRes, savedEvents, organizer, placardsRes, prefsRes] =
    await Promise.all([
      supabase
        .from('event_submissions')
        .select('id, title, venue_name, date, status, admin_note, created_at')
        .eq('submitted_by_user_id', user.id)
        .order('created_at', { ascending: false }),
      fetchSavedEventCards(supabase, user.id),
      fetchOrganizer(supabase),
      supabase
        .from('placards')
        .select(
          'id, image_url, caption, city, status, vote_count, report_count, admin_note, created_at',
        )
        .eq('submitted_by', user.id)
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .maybeSingle(),
    ])

  const userSubmissions: Submission[] = submissionsRes.data ?? []

  // Split saved events into Upcoming vs Past so the section reads at a glance
  // instead of mixing tomorrow's protest with last month's gig.
  const upcomingSaved = savedEvents.filter((e) =>
    isEventActive({ date: e.date, time: e.time }),
  )
  const pastSaved = savedEvents.filter(
    (e) => !isEventActive({ date: e.date, time: e.time }),
  )

  type PlacardRowMinimal = {
    id: string
    image_url: string | null
    caption: string | null
    city: string | null
    status: string
    vote_count: number | null
    report_count: number | null
    admin_note: string | null
    created_at: string
  }
  const myPlacards: MyPlacardCard[] = (
    (placardsRes.data as PlacardRowMinimal[] | null) ?? []
  )
    .filter((row): row is PlacardRowMinimal & { image_url: string } => !!row.image_url)
    .map((row) => ({
      id: row.id,
      imageUrl: row.image_url,
      caption: row.caption,
      city: row.city,
      status:
        row.status === 'approved' || row.status === 'rejected'
          ? row.status
          : 'pending',
      voteCount: row.vote_count ?? 0,
      reportCount: row.report_count ?? 0,
      createdAt: row.created_at,
      adminNote: row.admin_note,
    }))

  const prefs = (prefsRes.data?.notification_preferences ?? {}) as {
    saved_event_updates?: boolean
  }
  const savedEventUpdates = prefs.saved_event_updates !== false

  const stats = [
    {
      label: 'Saved events',
      value: savedEvents.length,
      icon: Heart,
      href: '#saved-upcoming',
    },
    {
      label: 'Event submissions',
      value: userSubmissions.length,
      icon: Send,
      href: '#my-submissions',
    },
    {
      label: 'Placards uploaded',
      value: myPlacards.length,
      icon: ImageIcon,
      href: '#my-placards',
    },
  ]

  const friendlyName = firstName(
    profile?.display_name as string | undefined,
    user.email?.split('@')[0] ?? 'there',
  )

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

          {/* Stat strip */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <a
                  key={stat.label}
                  href={stat.href}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05] sm:p-6"
                >
                  <Icon className="h-5 w-5 text-flame-400 sm:h-6 sm:w-6" />
                  <div className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-[11px] text-white/55 sm:text-xs">
                    {stat.label}
                  </div>
                </a>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Link
              href="/submit-event"
              className="group flex items-center gap-3 rounded-2xl border border-flame-500/30 bg-flame-500/[0.08] px-4 py-3 transition hover:border-flame-500/50 hover:bg-flame-500/[0.14]"
            >
              <Send className="h-4 w-4 text-flame-300" />
              <span className="text-sm font-semibold text-white">Submit event</span>
              <ArrowRight className="ml-auto h-4 w-4 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white/85" />
            </Link>
            <Link
              href="/pankartat"
              className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <Camera className="h-4 w-4 text-flame-300" />
              <span className="text-sm font-semibold text-white">Upload placard</span>
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

          {/* My placards */}
          <section id="my-placards" className="mt-10 scroll-mt-24">
            <div className="flex items-end justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                <ImageIcon className="h-3.5 w-3.5" />
                My placards
              </h2>
              <span className="text-xs text-white/35">{myPlacards.length}</span>
            </div>
            <MyPlacardsList placards={myPlacards} />
          </section>

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

