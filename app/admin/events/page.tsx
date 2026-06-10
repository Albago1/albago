import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'
import EventsAdminClient from './EventsAdminClient'

export const metadata: Metadata = {
  title: 'Admin · Events & Protests',
}

export default async function AdminEventsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/admin/events')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-12 pt-24 text-white">
        <EventsAdminClient />
      </main>
    </>
  )
}
