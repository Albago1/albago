import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultEventDraft, type DraftTicketTier, type EventDraft } from '@/types/eventDraft'

/**
 * Map a raw `events` row into a wizard `EventDraft`. Shared by every "edit /
 * repost via the wizard" surface (organizer dashboard + admin) so the create
 * and edit flows are the exact same wizard, seeded from the saved event.
 *
 * `keepSchedule: false` blanks the date/time (used by Repost — a repost is a
 * fresh listing that needs new dates); editing keeps the schedule intact.
 */
export function eventRowToDraft(
  row: Record<string, unknown>,
  opts?: { keepSchedule?: boolean },
): EventDraft {
  const socials = (row.organizer_socials as EventDraft['organizer_socials']) ?? {}
  const expected = row.expected_attendees
  const gallery = Array.isArray(row.gallery_urls) ? (row.gallery_urls as string[]) : []
  return {
    ...defaultEventDraft,
    event_type: row.is_civic ? 'protest' : 'event',
    is_civic: Boolean(row.is_civic),
    is_online: Boolean(row.is_online),
    category: (row.category as string) ?? '',
    title: (row.title as string) ?? '',
    description: (row.description as string) ?? '',
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    language: (row.language as string) ?? 'en',
    // Repost clears the schedule so the organizer must enter fresh dates;
    // editing keeps it — the whole point is amending the existing listing.
    date: opts?.keepSchedule ? ((row.date as string) ?? '') : '',
    end_date: opts?.keepSchedule ? ((row.end_date as string) ?? '') : '',
    time: opts?.keepSchedule ? ((row.time as string) ?? '') : '',
    end_time: opts?.keepSchedule ? ((row.end_time as string) ?? '') : '',
    timezone: (row.timezone as string) ?? defaultEventDraft.timezone,
    location_slug: (row.location_slug as string) ?? '',
    country: (row.country as string) ?? '',
    region: (row.region as string) ?? '',
    city: (row.city as string) ?? '',
    address: (row.address as string) ?? '',
    address_hint: (row.address_hint as string) ?? '',
    venue_name: (row.venue_name as string) ?? '',
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    online_url: (row.online_url as string) ?? '',
    gallery_urls: gallery.length
      ? gallery
      : row.banner_url
        ? [row.banner_url as string]
        : [],
    cover_in_gallery:
      typeof row.cover_in_gallery === 'boolean' ? row.cover_in_gallery : true,
    content_sections: Array.isArray(row.content_sections)
      ? (row.content_sections as EventDraft['content_sections'])
      : [],
    organizer_name: (row.organizer_name as string) ?? '',
    organizer_contact: (row.organizer_contact as string) ?? '',
    organizer_phone: (row.organizer_phone as string) ?? '',
    organizer_website: (row.organizer_website as string) ?? '',
    organizer_socials: socials,
    price: (row.price as string) ?? '',
    featured_movement_slug: (row.featured_movement_slug as string) ?? '',
    telegram_link: (row.telegram_link as string) ?? '',
    whatsapp_link: (row.whatsapp_link as string) ?? '',
    safety_notes: (row.safety_notes as string) ?? '',
    expected_attendees: expected != null ? String(expected) : '',
    recurrence: ((row.recurrence as EventDraft['recurrence']) ?? 'none'),
    recurrence_until: (row.recurrence_until as string) ?? '',
    recurrence_days_of_week: Array.isArray(row.recurrence_days_of_week)
      ? (row.recurrence_days_of_week as number[])
      : [],
    recurrence_exceptions: Array.isArray(row.recurrence_exceptions)
      ? (row.recurrence_exceptions as string[])
      : [],
  }
}

/**
 * Load an event's live free tiers into the wizard draft shape (Phase 33).
 * Editing keeps the tier ids so saving updates them in place; reposting
 * strips the ids so the setup is recreated fresh on the new event.
 */
export async function fetchDraftTiers(
  supabase: SupabaseClient,
  eventId: string,
  opts: { keepIds: boolean },
): Promise<DraftTicketTier[] | null> {
  const { data } = await supabase
    .from('ticket_tiers')
    .select('id, name, capacity, max_per_order')
    .eq('event_id', eventId)
    .in('status', ['active', 'paused'])
    .order('sort_order', { ascending: true })
  const rows =
    (data as Array<{
      id: string
      name: string
      capacity: number
      max_per_order: number
    }> | null) ?? []
  if (rows.length === 0) return null
  return rows.map((row) => ({
    id: opts.keepIds ? row.id : null,
    name: row.name,
    capacity: String(row.capacity),
    maxPerOrder: String(row.max_per_order),
  }))
}
