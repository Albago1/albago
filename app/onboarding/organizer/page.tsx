import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchOrganizer } from '@/lib/organizers'
import OnboardingClient from './OnboardingClient'

export const metadata: Metadata = {
  title: 'Become an Organizer',
}

export default async function OnboardingOrganizerPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/onboarding/organizer')

  const organizer = await fetchOrganizer(supabase)
  if (organizer) redirect('/organizer')

  return <OnboardingClient email={user.email ?? ''} />
}
