import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import AdminPlacardsClient from './AdminPlacardsClient'
import type { PlacardRow } from '@/lib/placards'

export const metadata: Metadata = {
  title: 'Admin · Pankartat',
}

export default async function AdminPlacardsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/admin/placards')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data, error } = await supabase
    .from('placards')
    .select(
      'id, slogan, language, categories, city, status, vote_count, submitted_by, submitter_name, admin_note, created_at, updated_at, approved_at, image_url, caption, report_count',
    )
    .order('report_count', { ascending: false })
    .order('created_at', { ascending: false })

  const rows = (!error && Array.isArray(data) ? (data as PlacardRow[]) : []) as PlacardRow[]
  const migrationApplied = !error

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-16 pt-24 text-white">
        <AdminPlacardsClient initialRows={rows} migrationApplied={migrationApplied} />
      </main>
    </>
  )
}
