import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminEditEventClient from './AdminEditEventClient'

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

  // select('*') so the wizard seeds from the complete row (address_hint,
  // gallery_urls, cover_in_gallery, content_sections, venue_name, city, …).
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !event) notFound()

  return (
    <div className="px-4 py-6 sm:px-6">
      <AdminEditEventClient event={event as Record<string, unknown>} />
    </div>
  )
}
