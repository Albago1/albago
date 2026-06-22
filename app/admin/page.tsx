import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CalendarCheck,
  Clock,
  Flag,
  HandHeart,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Send,
  ShieldCheck,
  Users as UsersIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'

export const metadata: Metadata = {
  title: 'Admin · AlbaGo',
}

// Admin gate is handled by app/admin/layout.tsx — this page just renders.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type CountResult = { count: number | null; error: { message: string } | null }

function safeCount(res: CountResult | null | undefined): number {
  if (!res || res.error) return 0
  return res.count ?? 0
}

export default async function AdminHomePage() {
  const supabase = await createClient()
  const today = new Date()
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')

  // Every count is a head-only query so the wire stays small. Each one is
  // wrapped so a missing table (e.g. placard_reports before Phase 24 applied)
  // doesn't blow up the whole page — we just show 0.
  const [
    publishedEvents,
    upcomingEvents,
    pendingSubmissions,
    pendingPlacards,
    reportedPlacards,
    pendingOrganizers,
    newVolunteers,
    totalUsers,
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
      .from('placards')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('placards')
      .select('id', { count: 'exact', head: true })
      .gt('report_count', 0)
      .neq('status', 'rejected'),
    supabase
      .from('organizers')
      .select('id', { count: 'exact', head: true })
      .eq('id_review_status', 'pending'),
    supabase
      .from('volunteer_signups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
  ])

  const counts = {
    publishedEvents: safeCount(publishedEvents),
    upcomingEvents: safeCount(upcomingEvents),
    pendingSubmissions: safeCount(pendingSubmissions),
    pendingPlacards: safeCount(pendingPlacards),
    reportedPlacards: safeCount(reportedPlacards),
    pendingOrganizers: safeCount(pendingOrganizers),
    newVolunteers: safeCount(newVolunteers),
    totalUsers: safeCount(totalUsers),
  }

  const totalPending =
    counts.pendingSubmissions +
    counts.pendingPlacards +
    counts.pendingOrganizers +
    counts.newVolunteers +
    counts.reportedPlacards

  const kpis = [
    {
      label: 'Published events',
      value: counts.publishedEvents,
      icon: Calendar,
      tone: 'text-flame-400',
    },
    {
      label: 'Upcoming events',
      value: counts.upcomingEvents,
      icon: CalendarCheck,
      tone: 'text-flame-400',
    },
    {
      label: 'Registered users',
      value: counts.totalUsers,
      icon: UsersIcon,
      tone: 'text-flame-400',
    },
    {
      label: 'Awaiting action',
      value: totalPending,
      icon: Inbox,
      tone: totalPending > 0 ? 'text-amber-400' : 'text-white/65',
    },
  ]

  type Tile = {
    href: string
    title: string
    description: string
    icon: typeof Inbox
    pending?: number
    pendingLabel?: string
    accentWhenPending?: boolean
  }

  const tiles: Tile[] = [
    {
      href: '/admin/queue',
      title: 'Moderation queue',
      description:
        'Unified review of community submissions and live events — approve, edit, archive, repost.',
      icon: Inbox,
      pending: counts.pendingSubmissions,
      pendingLabel: 'pending',
      accentWhenPending: true,
    },
    {
      href: '/admin/events',
      title: 'Events',
      description: 'Every event in the system. Filter by status, search, and edit.',
      icon: Megaphone,
    },
    {
      href: '/admin/organizers',
      title: 'Organizers',
      description:
        'Approve verification, see established / verified tiers, manage profiles.',
      icon: BadgeCheck,
      pending: counts.pendingOrganizers,
      pendingLabel: 'awaiting review',
      accentWhenPending: true,
    },
    {
      href: '/admin/placards',
      title: 'Placards',
      description: 'Approve / reject community-uploaded photos. Triage reports.',
      icon: ImageIcon,
      pending: counts.pendingPlacards + counts.reportedPlacards,
      pendingLabel:
        counts.reportedPlacards > 0
          ? `${counts.pendingPlacards} pending · ${counts.reportedPlacards} reported`
          : 'pending',
      accentWhenPending: true,
    },
    {
      href: '/admin/volunteers',
      title: 'Volunteers',
      description: 'New signups, contact status, retire decided rows.',
      icon: HandHeart,
      pending: counts.newVolunteers,
      pendingLabel: 'new',
      accentWhenPending: true,
    },
    {
      href: '/admin/users',
      title: 'Users',
      description: 'Roles, account state, granted admin / organizer rights.',
      icon: UsersIcon,
    },
    {
      href: '/admin/share-batch',
      title: 'Share batch',
      description: 'One-click ZIP of share posters for every upcoming civic event.',
      icon: Send,
    },
  ]

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-16 pt-24 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <ShieldCheck className="h-5 w-5 text-flame-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Admin</h1>
                <p className="mt-0.5 text-sm text-white/45">
                  Platform health and moderation entry point
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/queue"
                className={[
                  'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition',
                  totalPending > 0
                    ? 'bg-flame-500 text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] hover:bg-flame-400'
                    : 'border border-white/15 bg-white/[0.04] text-white/85 hover:bg-white/[0.08] hover:text-white',
                ].join(' ')}
              >
                <Inbox className="h-4 w-4" />
                {totalPending > 0
                  ? `${totalPending} awaiting action`
                  : 'Open moderation queue'}
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                <LayoutDashboard className="h-4 w-4" />
                My dashboard
              </Link>
            </div>
          </div>

          {/* KPI strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
              >
                <Icon className={`h-5 w-5 ${tone}`} />
                <div className={`mt-3 text-3xl font-bold ${tone}`}>{value}</div>
                <div className="mt-1 text-[11px] text-white/55 sm:text-xs">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Tile grid */}
          <section className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Areas
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {tiles.map((tile) => {
                const Icon = tile.icon
                const hasPending = (tile.pending ?? 0) > 0
                const accent = hasPending && tile.accentWhenPending
                return (
                  <Link
                    key={tile.href}
                    href={tile.href}
                    className={[
                      'group block rounded-3xl border p-5 transition',
                      accent
                        ? 'border-amber-500/25 bg-amber-500/[0.06] hover:border-amber-500/40 hover:bg-amber-500/[0.10]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={[
                            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border',
                            accent
                              ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                              : 'border-white/10 bg-white/[0.04] text-flame-300',
                          ].join(' ')}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">
                            {tile.title}
                          </h3>
                          <p className="mt-1 text-sm leading-snug text-white/55">
                            {tile.description}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-5 w-5 flex-shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
                    </div>
                    {hasPending && (
                      <div className="mt-4 flex items-center gap-2 text-xs">
                        <span
                          className={[
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold',
                            accent
                              ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                              : 'border-white/10 bg-white/[0.04] text-white/85',
                          ].join(' ')}
                        >
                          {tile.title === 'Placards' &&
                          counts.reportedPlacards > 0 ? (
                            <Flag className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          <span>
                            {tile.pending} {tile.pendingLabel}
                          </span>
                        </span>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
