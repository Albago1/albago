import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'
import { fetchOrganizer } from '@/lib/organizers'
import CreateEventClient from './CreateEventClient'

export const metadata: Metadata = {
  title: 'Create Event — AlbaGo',
}

export default async function CreateEventPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/organizer/create')

  const organizer = await fetchOrganizer(supabase)
  if (!organizer) redirect('/onboarding/organizer')

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-12 pt-24 text-white">
        <CreateEventClient />
      </main>
    </>
  )
}
