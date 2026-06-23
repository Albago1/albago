import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditEventClient, { type EditableEvent } from './EditEventClient'

export const metadata: Metadata = {
  title: 'Admin · Edit event',
}

export default async function AdminEditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/sign-in?next=/admin/events/${id}/edit`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: event, error } = await supabase
    .from('events')
    .select(
      'id, slug, title, description, category, date, time, end_time, timezone, price, highlight, status, location_slug, country, region, lat, lng, address, is_online, online_url, tags, language, banner_url, admin_note, event_type, is_civic, featured_movement_slug, organizer_contact, organizer_name, organizer_phone, organizer_website, organizer_socials, telegram_link, whatsapp_link, safety_notes, expected_attendees, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions, origin, organizer_id, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !event) notFound()

  return (
    <div className="px-4 py-6 sm:px-6">
      <EditEventClient initial={event as EditableEvent} />
    </div>
  )
}
