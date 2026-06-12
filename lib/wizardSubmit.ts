import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventDraft } from '@/types/eventDraft'

export type SubmitResult =
  | { id: string; error: null }
  | { id: null; error: string }

function trim(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = s.trim()
  return t.length ? t : null
}

function hasAnySocial(socials: EventDraft['organizer_socials']): boolean {
  return Object.values(socials).some((v) => typeof v === 'string' && v.trim().length > 0)
}

function cleanSocials(socials: EventDraft['organizer_socials']) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(socials)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return out
}

function parseAttendees(raw: string): number | null {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) return null
  return Math.max(0, Math.min(5_000_000, n))
}

/**
 * Submit a community-mode wizard draft. Inserts a row into event_submissions
 * with status='pending'. Requires the user to be signed in (admins approve
 * submissions later, but only authenticated users can submit — same as the
 * existing /submit-event flow).
 */
export async function submitCommunityEvent(
  supabase: SupabaseClient,
  draft: EventDraft,
): Promise<SubmitResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { id: null, error: 'Sign in to submit an event.' }
  }

  const isCivic = draft.event_type === 'protest' ? true : draft.is_civic
  const category = draft.category || (isCivic ? 'civic' : 'culture')
  const venueName =
    trim(draft.venue_name) ||
    trim(draft.city) ||
    trim(draft.address?.split(',')[0]) ||
    'TBA'

  const submission = {
    title: draft.title.trim(),
    venue_name: venueName,
    place_id: null,
    date: draft.date,
    time: trim(draft.time),
    end_time: trim(draft.end_time),
    timezone: trim(draft.timezone),
    category,
    price: trim(draft.price),
    contact_email: trim(draft.organizer_contact),
    description: draft.description.trim(),
    country: trim(draft.country) ?? 'Unknown',
    region: trim(draft.region),
    location_slug: trim(draft.location_slug) ?? 'unknown',
    lat: draft.lat,
    lng: draft.lng,
    address: trim(draft.address),
    is_online: draft.is_online,
    online_url: trim(draft.online_url),
    tags: draft.tags,
    language: trim(draft.language) ?? 'en',
    gallery_urls: draft.gallery_urls,
    status: 'pending',
    submitted_by_user_id: user.id,
    // The DB CHECK on event_type only accepts the civic subtypes
    // ('protest' / 'civic_gathering' / 'movement_event' / 'demonstration')
    // or NULL. The wizard stores the literal 'event' for non-civic
    // submissions — translate that to NULL here so we don't trip
    // event_submissions_event_type_check.
    event_type: draft.event_type === 'protest' ? 'protest' : null,
    is_civic: isCivic,
    featured_movement_slug: trim(draft.featured_movement_slug),
    organizer_name: trim(draft.organizer_name),
    organizer_contact: trim(draft.organizer_contact),
    organizer_phone: trim(draft.organizer_phone),
    organizer_website: trim(draft.organizer_website),
    organizer_socials: hasAnySocial(draft.organizer_socials)
      ? cleanSocials(draft.organizer_socials)
      : null,
    telegram_link: trim(draft.telegram_link),
    whatsapp_link: trim(draft.whatsapp_link),
    safety_notes: trim(draft.safety_notes),
    expected_attendees: draft.expected_attendees
      ? parseAttendees(draft.expected_attendees)
      : null,
    recurrence: draft.recurrence,
    recurrence_until: trim(draft.recurrence_until),
    recurrence_days_of_week: draft.recurrence_days_of_week,
    recurrence_exceptions: draft.recurrence_exceptions,
  }

  const { data, error } = await supabase
    .from('event_submissions')
    .insert(submission)
    .select('id')
    .single()

  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      return {
        id: null,
        error:
          'Database is missing Phase 13 columns on event_submissions. Apply docs/seeds/phase-13-event-rich-data.sql in Supabase.',
      }
    }
    if (error.code === '42501') {
      return {
        id: null,
        error: 'Server refused the insert. Check the event_submissions RLS policies.',
      }
    }
    return { id: null, error: error.message }
  }

  return { id: (data?.id as string) ?? 'submitted', error: null }
}

/**
 * Submit an organizer-mode wizard draft via the organizer_create_event_v2 RPC.
 * Creates a draft event owned by auth.uid() with origin='organizer_dashboard'
 * and status='draft'. The organizer can submit it for review separately.
 */
export async function submitOrganizerDraft(
  supabase: SupabaseClient,
  draft: EventDraft,
): Promise<SubmitResult> {
  const isCivic = draft.event_type === 'protest' ? true : draft.is_civic
  const category = draft.category || (isCivic ? 'civic' : 'culture')

  const input = {
    title: draft.title.trim(),
    place_id: null,
    category,
    description: draft.description.trim(),
    date: draft.date,
    time: trim(draft.time),
    end_time: trim(draft.end_time),
    timezone: trim(draft.timezone),
    price: trim(draft.price),
    country: trim(draft.country) ?? 'Albania',
    region: trim(draft.region),
    location_slug: trim(draft.location_slug) ?? 'tirana',
    lat: draft.lat,
    lng: draft.lng,
    address: trim(draft.address),
    is_online: draft.is_online,
    online_url: trim(draft.online_url),
    tags: draft.tags,
    language: trim(draft.language) ?? 'en',
    gallery_urls: draft.gallery_urls,
    organizer_name: trim(draft.organizer_name),
    organizer_phone: trim(draft.organizer_phone),
    organizer_website: trim(draft.organizer_website),
    organizer_socials: hasAnySocial(draft.organizer_socials)
      ? cleanSocials(draft.organizer_socials)
      : null,
    is_civic: isCivic,
    // The DB CHECK on event_type only accepts the civic subtypes
    // ('protest' / 'civic_gathering' / 'movement_event' / 'demonstration')
    // or NULL. The wizard stores the literal 'event' for non-civic
    // submissions — translate that to NULL here so we don't trip
    // event_submissions_event_type_check.
    event_type: draft.event_type === 'protest' ? 'protest' : null,
    featured_movement_slug: trim(draft.featured_movement_slug),
    organizer_contact: trim(draft.organizer_contact),
    telegram_link: trim(draft.telegram_link),
    whatsapp_link: trim(draft.whatsapp_link),
    safety_notes: trim(draft.safety_notes),
    expected_attendees: draft.expected_attendees
      ? String(parseAttendees(draft.expected_attendees) ?? '')
      : null,
    recurrence: draft.recurrence,
    recurrence_until: trim(draft.recurrence_until),
    recurrence_days_of_week: draft.recurrence_days_of_week,
    recurrence_exceptions: draft.recurrence_exceptions,
  }

  const { data, error } = await supabase.rpc('organizer_create_event_v2', {
    input,
  })

  if (error) {
    if (error.message.includes('not_authenticated')) {
      return { id: null, error: 'Sign in to create an event.' }
    }
    if (error.message.includes('not_organizer')) {
      return {
        id: null,
        error: 'Complete organizer onboarding before creating events.',
      }
    }
    if (error.code === '42501' || /permission denied/i.test(error.message)) {
      return {
        id: null,
        error:
          'Server refused the request. GRANT EXECUTE may be missing for organizer_create_event_v2.',
      }
    }
    if (/function .* does not exist/i.test(error.message)) {
      return {
        id: null,
        error:
          'organizer_create_event_v2 RPC is missing. Apply docs/seeds/phase-13-event-rich-data.sql in Supabase.',
      }
    }
    return { id: null, error: error.message }
  }

  return { id: data as string, error: null }
}
