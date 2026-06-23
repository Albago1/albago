import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminRail from '@/components/admin/AdminRail'
import AdminTopBar from '@/components/admin/AdminTopBar'
import AdminCommandPalette from '@/components/admin/AdminCommandPalette'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in?next=/admin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  const [
    pendingSubmissions,
    pendingPlacards,
    reportedPlacards,
    pendingOrganizers,
    newVolunteers,
  ] = await Promise.all([
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
  ])

  const counts = {
    pendingSubmissions: pendingSubmissions.count ?? 0,
    pendingPlacards: pendingPlacards.count ?? 0,
    reportedPlacards: reportedPlacards.count ?? 0,
    pendingOrganizers: pendingOrganizers.count ?? 0,
    newVolunteers: newVolunteers.count ?? 0,
  }

  return (
    <div className="flex min-h-screen bg-ink-950 text-white">
      <AdminRail counts={counts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
      <AdminCommandPalette />
    </div>
  )
}
