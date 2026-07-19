import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchOrganizer } from '@/lib/organizers'
import VerificationClient from './VerificationClient'

export const metadata: Metadata = {
  title: 'Organizer Verification',
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

export default async function OrganizerVerificationPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/organizer/verification')

  const organizer = await fetchOrganizer(supabase)
  if (!organizer) redirect('/onboarding/organizer')

  // Count published events in the last 90 days for the auto-promote progress bar.
  const ninetyDaysAgoIso = isoDaysAgo(90)

  const { count: publishedRecentCount } = await supabase
    .from('events')
    .select('*', { head: true, count: 'exact' })
    .eq('organizer_id', user.id)
    .eq('status', 'published')
    .gte('date', ninetyDaysAgoIso)

  return (
    <VerificationClient
      organizer={organizer}
      publishedRecentCount={publishedRecentCount ?? 0}
    />
  )
}
