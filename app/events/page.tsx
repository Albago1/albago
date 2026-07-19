import type { Metadata } from 'next'
import EventsClient from './EventsClient'
import type { PublicEvent } from '@/components/events/EventCard'
import { createClient } from '@/lib/supabase/server'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Browse and search events across Albania and the Albanian diaspora — nightlife, music, culture, food, sports, and peaceful civic gatherings. Filter by city, time, and category.',
  // Query variants (?q=, ?location=, …) are client-side filters over the same
  // inventory — canonicalize them all to the bare directory so crawled search
  // URLs (incl. the old {search_term_string} artifact) don't index separately.
  alternates: { canonical: '/events' },
  openGraph: {
    title: 'Events — AlbaGo',
    description:
      'A live, mobile-first events directory for Albania and the Albanian diaspora. Find what is happening tonight, this weekend, or in your city.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Events — AlbaGo',
    description:
      'Discover events across Albania and the Albanian diaspora. Search any city.',
  },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Server-render the initial event list (audit P2 #10): crawlers and first
// paint get real event cards instead of an empty client shell. The client
// component takes over from there for filtering, search, and live updates.
// Search mode (?q=) keeps its client-side path — the place-match + full-text
// logic lives there; SSR would duplicate it for no SEO gain (those URLs
// canonicalize to /events anyway).
export default async function EventsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams
  const location = typeof sp.location === 'string' ? sp.location : 'all'
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''

  let initialEvents: PublicEvent[] | null = null
  let initialPlaceNames: Array<[string, string]> | null = null

  if (!q) {
    try {
      const supabase = await createClient()
      const eventsQuery = supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .or(activeEventsOrFilter())
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      const placesQuery = supabase.from('places').select('id, name')
      const [eventsRes, placesRes] = await Promise.all([
        location === 'all' ? eventsQuery : eventsQuery.eq('location_slug', location),
        location === 'all' ? placesQuery : placesQuery.eq('location_slug', location),
      ])
      if (!eventsRes.error) {
        initialEvents = ((eventsRes.data ?? []) as PublicEvent[]).filter(isEventActive)
        initialPlaceNames = ((placesRes.data ?? []) as Array<{ id: string; name: string }>).map(
          (p) => [p.id, p.name],
        )
      }
    } catch {
      // Server fetch is best-effort — the client falls back to its own fetch.
    }
  }

  return (
    <EventsClient
      initialEvents={initialEvents}
      initialPlaceNames={initialPlaceNames}
    />
  )
}
