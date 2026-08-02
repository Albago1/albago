import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchOrganizer } from '@/lib/organizers'
import { fetchOrganizerEvents } from '@/lib/events-organizer'
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

  const [events, { data: profileRow }] = await Promise.all([
    fetchOrganizerEvents(supabase),
    supabase
      .from('profiles')
      .select('role, studio_access')
      .eq('id', user.id)
      .maybeSingle(),
  ])
  const profile = profileRow as {
    role?: string | null
    studio_access?: boolean | null
  } | null
  const studioAccess = profile?.role === 'admin' || profile?.studio_access === true

  // Which of this organizer's events have live ticket tiers — so the dashboard
  // can show a "Tickets" action only where there's something to manage. RLS
  // scopes ticket_tiers reads to the owner; we still constrain to our event ids.
  const eventIds = events.map((e) => e.id)
  let eventIdsWithTickets: string[] = []
  if (eventIds.length > 0) {
    const { data: tierRows } = await supabase
      .from('ticket_tiers')
      .select('event_id')
      .in('event_id', eventIds)
      .neq('status', 'archived')
    eventIdsWithTickets = [
      ...new Set(((tierRows as { event_id: string }[] | null) ?? []).map((r) => r.event_id)),
    ]
  }

  return (
    <OrganizerDashboardClient
      organizer={organizer}
      events={events}
      studioAccess={studioAccess}
      eventIdsWithTickets={eventIdsWithTickets}
    />
  )
}
