import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMovementBySlug, MOVEMENTS } from '@/lib/movements'
import type { ProtestEvent } from '@/components/protest/ProtestEventCard'
import MovementClient from './MovementClient'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'

type Params = { slug: string }

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

export async function generateStaticParams(): Promise<Params[]> {
  return MOVEMENTS.map((m) => ({ slug: m.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { slug } = await params
  const movement = getMovementBySlug(slug)
  if (!movement) return { title: 'Movement not found' }

  return {
    title: `${movement.name} — AlbaGo`,
    description: movement.description,
    openGraph: {
      title: `${movement.name} — ${movement.tagline}`,
      description: movement.description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${movement.name} — AlbaGo`,
      description: movement.tagline,
    },
  }
}

export default async function MovementPage(
  { params }: { params: Promise<Params> },
) {
  const { slug } = await params
  const movement = getMovementBySlug(slug)
  if (!movement) notFound()

  const supabase = await createClient()

  let events: ProtestEvent[] = []
  let migrationApplied = true

  const wide = await supabase
    .from('events')
    .select(
      'id, slug, title, description, date, time, end_time, category, price, highlight, place_id, location_slug, country, region, lat, lng, event_type, is_civic, organizer_contact, telegram_link, whatsapp_link, safety_notes, expected_attendees, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
    )
    .eq('status', 'published')
    .eq('is_civic', true)
    .eq('featured_movement_slug', slug)
    .or(activeEventsOrFilter())
    .order('date', { ascending: true })

  if (wide.error) {
    migrationApplied = false
  } else {
    const rows = ((wide.data ?? []) as EventRow[]).filter(isEventActive)
    events = rows.map((row) => ({
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
      placeName: null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      address: null,
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
    }))
  }

  return (
    <MovementClient
      movement={movement}
      events={events}
      migrationApplied={migrationApplied}
    />
  )
}
