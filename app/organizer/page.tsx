import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchOrganizer } from '@/lib/organizers'
import OrganizerDashboardClient from './OrganizerDashboardClient'

export const metadata: Metadata = {
  title: 'Organizer Dashboard',
}

export default async function OrganizerPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/organizer')

  const organizer = await fetchOrganizer(supabase)
  if (!organizer) redirect('/onboarding/organizer')

  return <OrganizerDashboardClient organizer={organizer} />
}
