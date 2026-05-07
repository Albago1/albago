import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Send,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // — Admin view —
  if (profile?.role === 'admin') {
    const [eventsRes, pendingRes, placesRes] = await Promise.all([
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('event_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase.from('places').select('*', { count: 'exact', head: true }),
    ])

    const stats = [
      {
        label: 'Published Events',
        value: eventsRes.count ?? 0,
        icon: Calendar,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/20',
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
      <main className="min-h-screen bg-[#070b14] p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <LayoutDashboard className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="mt-0.5 text-sm text-white/45">{user.email}</p>
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
        </div>
      </main>
    )
  }

  // — Regular user view —
  const { data: submissions } = await supabase
    .from('event_submissions')
    .select('id, title, venue_name, date, status, admin_note, created_at')
    .eq('submitted_by_user_id', user.id)
    .order('created_at', { ascending: false })

  const userSubmissions: Submission[] = submissions ?? []

  return (
    <main className="min-h-screen bg-[#070b14] p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <LayoutDashboard className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">My Dashboard</h1>
              <p className="mt-0.5 text-sm text-white/45">{user.email}</p>
            </div>
          </div>

          <Link
            href="/submit-event"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <Send className="h-4 w-4" />
            Submit event
          </Link>
        </div>

        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            My submissions
          </h2>

          {userSubmissions.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <Send className="mx-auto h-8 w-8 text-white/20" />
              <p className="mt-4 font-semibold text-white">No submissions yet</p>
              <p className="mt-1 text-sm text-white/50">
                Submit an event and track its review status here.
              </p>
              <Link
                href="/submit-event"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
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
        </div>
      </div>
    </main>
  )
}
