import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Calendar, MapPin, Clock, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/')

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
