import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchSavedEventIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()

  const { data } = await supabase
    .from('saved_events')
    .select('event_id')
    .eq('user_id', user.id)

  return new Set((data ?? []).map((row) => row.event_id))
}

export async function saveEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error } = await supabase
    .from('saved_events')
    .insert({ user_id: user.id, event_id: eventId })

  return { error: error?.message ?? null }
}

export async function unsaveEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error } = await supabase
    .from('saved_events')
    .delete()
    .eq('user_id', user.id)
    .eq('event_id', eventId)

  return { error: error?.message ?? null }
}
