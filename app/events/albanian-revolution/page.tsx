import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AlbanianRevolutionClient, {
  type MovementEvent,
} from './AlbanianRevolutionClient'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'

export const metadata: Metadata = {
  title: 'Albanian Revolution — Peaceful Worldwide Civic Movement',
  description:
    'A peaceful, lawful, worldwide civic-tech campaign coordinated through AlbaGo. Find a gathering near you, organize your city, or stand with the diaspora — calmly, openly, together.',
  openGraph: {
    title: 'Albanian Revolution — A Peaceful Movement',
    description:
      'Peaceful worldwide coordination of Albanian civic gatherings on AlbaGo.',
    type: 'website',
  },
}

const FEATURED_SLUG = 'albanian-revolution'

type EventRow = {
  id: string
  slug: string
  title: string
  description: string
  date: string
  time: string
  end_time: string | null
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

export default async function AlbanianRevolutionPage() {
  const supabase = await createClient()

  // Try the wide query first (Phase 8 columns present). If it fails because the
  // migration has not been applied yet, fall back to a safe minimal query so
  // the page still renders for new installs without the columns.
  let rows: EventRow[] = []
  let usedFallback = false

  const wide = await supabase
    .from('events')
    .select(
      'id, slug, title, description, date, time, end_time, category, price, highlight, place_id, location_slug, country, region, lat, lng, event_type, is_civic, featured_movement_slug, organizer_contact, telegram_link, whatsapp_link, safety_notes, expected_attendees, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
    )
    .eq('status', 'published')
    .eq('featured_movement_slug', FEATURED_SLUG)
    .or(activeEventsOrFilter())
    .order('date', { ascending: true })

  if (wide.error) {
    usedFallback = true
    // Migration not yet applied — show an empty-state version of the page.
    rows = []
  } else {
    rows = ((wide.data ?? []) as EventRow[]).filter(isEventActive)
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

  const events: MovementEvent[] = rows.map((row) => {
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
    }
  })

  return (
    <AlbanianRevolutionClient
      events={events}
      migrationApplied={!usedFallback}
    />
  )
}
