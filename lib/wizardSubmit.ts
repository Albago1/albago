import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventDraft } from '@/types/eventDraft'

export type SubmitResult =
  | { id: string; error: null }
  | { id: null; error: string }

export type AdminSubmitResult =
  | { id: string; slug: string; error: null }
  | { id: null; slug: null; error: string }

// Users should never see RPC names, seed-file paths, or RLS advice. Log the
// technical detail for debugging and hand back one calm, generic message.
const GENERIC_SUBMIT_ERROR =
  "Something went wrong on our side and your event wasn't submitted. Your draft is safe — please try again in a moment, or reach us via the contact page if it keeps happening."

function logSubmitError(context: string, error: { message: string; code?: string }) {
  console.error(`[${context}]`, error.code ?? '', error.message)
}

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
    // LENS-3: 4-language packs from a scanned poster. Null for typed
    // submissions — the RPC and approve flow both no-op on null.
    title_i18n: draft.title_i18n ?? null,
    description_i18n: draft.description_i18n ?? null,
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
    address_hint: trim(draft.address_hint),
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

  const { data, error } = await supabase.rpc('submit_event_submission', {
    p_payload: submission,
  })

  if (error) {
    if (/rate limit/i.test(error.message)) {
      // Surface the RPC's rate-limit message verbatim — it already reads well.
      return { id: null, error: error.message }
    }
    logSubmitError('submitCommunityEvent', error)
    return { id: null, error: GENERIC_SUBMIT_ERROR }
  }

  return { id: (data as string | null) ?? 'submitted', error: null }
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
    address_hint: trim(draft.address_hint),
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
    logSubmitError('submitOrganizerDraft', error)
    return { id: null, error: GENERIC_SUBMIT_ERROR }
  }

  return { id: data as string, error: null }
}

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

/**
 * Submit an admin-mode wizard draft. Inserts a published row straight into
 * events (RLS lets admins insert — same path the queue's Approve uses), so
 * the event is live on the public site immediately. Field mapping mirrors
 * AdminClient.approveSubmission, sourced from the wizard draft.
 */
export async function submitAdminEvent(
  supabase: SupabaseClient,
  draft: EventDraft,
): Promise<AdminSubmitResult> {
  const isCivic = draft.event_type === 'protest' ? true : draft.is_civic
  const category = draft.category || (isCivic ? 'civic' : 'culture')
  const locationSlug = trim(draft.location_slug) ?? 'unknown'
  const slug = `${createSlug(draft.title)}-${crypto.randomUUID().slice(0, 8)}`

  // Auto-seed the cities row like the approve flow does. Best-effort: a
  // failure here must not block publishing.
  if (draft.lat != null && draft.lng != null && locationSlug !== 'unknown') {
    const { error: cityError } = await supabase.rpc('upsert_city_from_event', {
      p_slug: locationSlug,
      p_name: locationSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      p_country: trim(draft.country) ?? 'Unknown',
      p_lat: draft.lat,
      p_lng: draft.lng,
    })
    if (cityError) {
      console.warn('upsert_city_from_event:', cityError.message)
    }
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      title: draft.title.trim(),
      title_i18n: draft.title_i18n ?? null,
      slug,
      place_id: null,
      category,
      description: draft.description.trim(),
      description_i18n: draft.description_i18n ?? null,
      date: draft.date,
      time: trim(draft.time),
      end_time: trim(draft.end_time),
      timezone: trim(draft.timezone),
      price: trim(draft.price),
      highlight: false,
      status: 'published',
      country: trim(draft.country) ?? 'Unknown',
      region: trim(draft.region),
      location_slug: locationSlug,
      lat: draft.lat,
      lng: draft.lng,
      address: trim(draft.address),
      address_hint: trim(draft.address_hint),
      is_online: draft.is_online,
      online_url: trim(draft.online_url),
      tags: draft.tags,
      language: trim(draft.language) ?? 'en',
      banner_url: draft.gallery_urls[0] ?? null,
      gallery_urls: draft.gallery_urls,
      organizer_name: trim(draft.organizer_name),
      organizer_phone: trim(draft.organizer_phone),
      organizer_website: trim(draft.organizer_website),
      organizer_socials: hasAnySocial(draft.organizer_socials)
        ? cleanSocials(draft.organizer_socials)
        : null,
      organizer_contact: trim(draft.organizer_contact),
      recurrence: draft.recurrence,
      recurrence_until: trim(draft.recurrence_until),
      recurrence_days_of_week: draft.recurrence_days_of_week,
      recurrence_exceptions: draft.recurrence_exceptions,
      ...(isCivic && {
        event_type: 'protest',
        is_civic: true,
        featured_movement_slug: trim(draft.featured_movement_slug),
        telegram_link: trim(draft.telegram_link),
        whatsapp_link: trim(draft.whatsapp_link),
        safety_notes: trim(draft.safety_notes),
        expected_attendees: draft.expected_attendees
          ? parseAttendees(draft.expected_attendees)
          : null,
      }),
    })
    .select('id')
    .single()

  if (error) {
    logSubmitError('submitAdminEvent', error)
    return { id: null, slug: null, error: GENERIC_SUBMIT_ERROR }
  }

  return { id: (data as { id: string }).id, slug, error: null }
}
