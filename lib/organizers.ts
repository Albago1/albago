import type { SupabaseClient } from '@supabase/supabase-js'
import type { Organizer, CreateOrganizerInput } from '@/types/organizer'

function slugifyOrganizer(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'organizer'
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6)
  return `${base}-${suffix}`
}

export async function fetchOrganizer(
  supabase: SupabaseClient
): Promise<Organizer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('organizers')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return data ?? null
}

export async function createOrganizer(
  supabase: SupabaseClient,
  input: CreateOrganizerInput
): Promise<{ error: string | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = slugifyOrganizer(input.displayName)

    const { error } = await supabase.rpc('create_organizer', {
      p_display_name: input.displayName,
      p_slug: slug,
      p_contact_email: input.contactEmail,
      p_website_url: input.websiteUrl || null,
      p_event_types: input.eventTypes,
      p_attendee_age_ranges: input.attendeeAgeRanges,
      p_expected_attendance_size: input.expectedAttendanceSize || null,
      p_expected_yearly_revenue: input.expectedYearlyRevenue || null,
      p_events_per_year: input.eventsPerYear || null,
    })

    if (!error) return { error: null }

    if (error.code === '23505') {
      if (error.message.includes('organizers_slug_key')) continue
      if (error.message.includes('organizers_pkey')) {
        return { error: 'You already have an organizer account.' }
      }
    }

    return { error: 'Something went wrong. Please try again.' }
  }

  return {
    error: "Couldn't reserve your organizer name. Try a slightly different display name.",
  }
}
