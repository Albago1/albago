import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_ADDRESS } from '@/lib/email/resend'
import { renderEventPublishedEmail } from '@/lib/email/templates/eventPublished'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://albago.org'

type Body = {
  eventId?: string
  contactEmail?: string | null
}

type EventRow = {
  id: string
  slug: string
  title: string
  date: string | null
  location_slug: string | null
  country: string | null
  organizer_id: string | null
  organizer_name: string | null
  organizer_contact: string | null
}

type OrganizerRow = {
  id: string
  display_name: string | null
  user_id: string | null
}

function formatCity(slug: string | null, country: string | null): string | null {
  if (slug) {
    const city = slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    return country ? `${city}, ${country}` : city
  }
  return country
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export async function POST(request: Request) {
  // 1. Caller must be an authenticated admin
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 2. Parse payload
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.eventId) {
    return NextResponse.json({ error: 'eventId_required' }, { status: 400 })
  }

  // 3. Look up the event using the admin client (bypasses RLS)
  const admin = createAdminClient()
  const { data: evRaw, error: evErr } = await admin
    .from('events')
    .select(
      'id, slug, title, date, location_slug, country, organizer_id, organizer_name, organizer_contact',
    )
    .eq('id', body.eventId)
    .maybeSingle()
  if (evErr) {
    return NextResponse.json(
      { error: 'event_query_failed', detail: evErr.message },
      { status: 500 },
    )
  }
  const ev = evRaw as EventRow | null
  if (!ev) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  // 4. Resolve recipient email + display name
  let recipientEmail: string | null = null
  let recipientName: string | null = null

  if (ev.organizer_id) {
    const { data: orgRaw } = await admin
      .from('organizers')
      .select('id, display_name, user_id')
      .eq('id', ev.organizer_id)
      .maybeSingle()
    const org = orgRaw as OrganizerRow | null
    if (org?.user_id) {
      const { data: userResult } = await admin.auth.admin.getUserById(
        org.user_id,
      )
      recipientEmail = userResult?.user?.email ?? null
      recipientName = org.display_name ?? null
    }
  }

  if (!recipientEmail) {
    const fallback =
      body.contactEmail ?? ev.organizer_contact ?? null
    if (fallback && /\S+@\S+\.\S+/.test(fallback)) {
      recipientEmail = fallback
      recipientName = ev.organizer_name ?? null
    }
  }

  if (!recipientEmail) {
    return NextResponse.json({ sent: 0, reason: 'no_recipient' })
  }

  // 5. Send via Resend
  const eventUrl = `${siteUrl}/events/${ev.slug}`
  const manageUrl = ev.organizer_id ? `${siteUrl}/organizer` : null
  const { subject, html, text } = renderEventPublishedEmail({
    recipientName,
    eventTitle: ev.title,
    eventUrl,
    cityLabel: formatCity(ev.location_slug, ev.country),
    dateLabel: formatDate(ev.date),
    manageUrl,
  })

  try {
    const resend = getResend()
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipientEmail,
      subject,
      html,
      text,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json(
      { sent: 0, error: 'resend_failed', detail },
      { status: 500 },
    )
  }

  return NextResponse.json({ sent: 1, recipient: recipientEmail })
}
