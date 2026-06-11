import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ProtestsClient from './ProtestsClient'
import type { ProtestEvent } from '@/components/protest/ProtestEventCard'

export const metadata: Metadata = {
  title: 'Protests Worldwide — AlbaGo',
  description:
    'Search peaceful civic gatherings happening in every city. Filter by country, date, and search any city in the world.',
  openGraph: {
    title: 'Protests Worldwide — AlbaGo',
    description:
      'Browse and search peaceful civic gatherings in every city, worldwide.',
    type: 'website',
  },
}

type EventRow = {
  id: string
  slug: string
  title: string
  description: string
  date: string
  time: string
  category: string
  price: string | null
  highlight: boolean | null
  place_id: string | null
  location_slug: string
  country: string
  region: string | null
  lat: number | null
  lng: number | null
  event_type: string | null
  is_civic: boolean | null
  featured_movement_slug: string | null
  organizer_contact: string | null
  telegram_link: string | null
  whatsapp_link: string | null
  safety_notes: string | null
  expected_attendees: number | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
}

type PlaceRow = {
  id: string
  name: string
  lat: number | null
  lng: number | null
  address: string | null
}

export default async function ProtestsPage() {
  const supabase = await createClient()

  // Try the wide query first (Phase 8 columns present). If it fails because the
  // migration has not been applied yet, fall back to an empty list so the page
  // still renders with the preview banner.
  let rows: EventRow[] = []
  let migrationApplied = true

  const wide = await supabase
    .from('events')
    .select(
      'id, slug, title, description, date, time, category, price, highlight, place_id, location_slug, country, region, lat, lng, event_type, is_civic, featured_movement_slug, organizer_contact, telegram_link, whatsapp_link, safety_notes, expected_attendees, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
    )
    .eq('status', 'published')
    .eq('is_civic', true)
    .order('date', { ascending: true })

  if (wide.error) {
    migrationApplied = false
    rows = []
  } else {
    rows = (wide.data ?? []) as EventRow[]
  }

  const placeIds = rows
    .map((row) => row.place_id)
    .filter((id): id is string => Boolean(id))

  let placeMap = new Map<string, PlaceRow>()
  if (placeIds.length > 0) {
    const { data: places } = await supabase
      .from('places')
      .select('id, name, lat, lng, address')
      .in('id', placeIds)
    if (places) {
      placeMap = new Map((places as PlaceRow[]).map((place) => [place.id, place]))
    }
  }

  const events: ProtestEvent[] = rows.map((row) => {
    const place = row.place_id ? placeMap.get(row.place_id) : undefined
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      date: row.date,
      time: row.time,
      category: row.category,
      price: row.price ?? null,
      highlight: row.highlight ?? false,
      placeId: row.place_id,
      placeName: place?.name ?? null,
      lat: row.lat ?? place?.lat ?? null,
      lng: row.lng ?? place?.lng ?? null,
      address: place?.address ?? null,
      locationSlug: row.location_slug,
      country: row.country,
      region: row.region ?? null,
      eventType: row.event_type ?? null,
      isCivic: row.is_civic ?? false,
      organizerContact: row.organizer_contact ?? null,
      telegramLink: row.telegram_link ?? null,
      whatsappLink: row.whatsapp_link ?? null,
      safetyNotes: row.safety_notes ?? null,
      expectedAttendees: row.expected_attendees ?? null,
      recurrence: row.recurrence ?? null,
      recurrenceUntil: row.recurrence_until ?? null,
      recurrenceDaysOfWeek: row.recurrence_days_of_week ?? null,
      recurrenceExceptions: row.recurrence_exceptions ?? null,
    }
  })

  return <ProtestsClient events={events} migrationApplied={migrationApplied} />
}
