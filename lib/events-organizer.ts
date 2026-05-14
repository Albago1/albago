import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrganizerEvent } from '@/types/event'

export type CreateEventInput = {
  title: string
  category: string
  description: string
  date: string
  time: string | null
  price: string | null
  location_slug: string
  country: string
  region: string | null
  place_id: string | null
}

function slugifyEvent(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'event'
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `${base}-${suffix}`
}

export async function fetchOrganizerEvents(
  supabase: SupabaseClient
): Promise<OrganizerEvent[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: false })

  return (data as OrganizerEvent[] | null) ?? []
}

export async function createOrganizerEvent(
  supabase: SupabaseClient,
  input: CreateEventInput
): Promise<{ id: string | null; error: string | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = slugifyEvent(input.title)

    const { data, error } = await supabase.rpc('organizer_create_event', {
      input: { ...input, slug },
    })

    if (!error) return { id: data as string, error: null }

    if (error.message.includes('not_organizer')) {
      return { id: null, error: 'You must complete organizer onboarding before creating events.' }
    }

    if (error.code === '23505') continue
  }

  return { id: null, error: 'Something went wrong. Please try again.' }
}

export async function submitOrganizerEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('organizer_submit_event', {
    event_id: eventId,
  })

  if (!error) return { error: null }

  if (error.message.includes('not_found_or_not_owner')) {
    return { error: 'Event not found or you do not own it.' }
  }
  if (error.message.includes('invalid_transition')) {
    return { error: 'This event cannot be submitted in its current state.' }
  }

  return { error: 'Something went wrong. Please try again.' }
}
