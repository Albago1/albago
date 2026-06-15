import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_ADDRESS } from '@/lib/email/resend'
import { renderSavedEventChangedEmail } from '@/lib/email/templates/savedEventChanged'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EventRow = {
  id: string
  slug: string
  title: string
  date: string | null
  time: string | null
  end_time: string | null
  address: string | null
  is_online: boolean | null
  online_url: string | null
  status: string | null
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: EventRow | null
  old_record: EventRow | null
}

type FieldChange = {
  label: string
  before: string | null
  after: string | null
}

const formatTime = (t: string | null): string | null => {
  if (!t) return null
  // Supabase returns time as "HH:MM:SS"; trim seconds for emails.
  return t.length >= 5 ? t.slice(0, 5) : t
}

function diffEvent(oldRow: EventRow, newRow: EventRow): FieldChange[] {
  const changes: FieldChange[] = []
  if (oldRow.date !== newRow.date) {
    changes.push({ label: 'Date', before: oldRow.date, after: newRow.date })
  }
  if (oldRow.time !== newRow.time) {
    changes.push({
      label: 'Start time',
      before: formatTime(oldRow.time),
      after: formatTime(newRow.time),
    })
  }
  if (oldRow.end_time !== newRow.end_time) {
    changes.push({
      label: 'End time',
      before: formatTime(oldRow.end_time),
      after: formatTime(newRow.end_time),
    })
  }
  if ((oldRow.address ?? '') !== (newRow.address ?? '')) {
    changes.push({
      label: 'Address',
      before: oldRow.address,
      after: newRow.address,
    })
  }
  if (!!oldRow.is_online !== !!newRow.is_online) {
    changes.push({
      label: 'Format',
      before: oldRow.is_online ? 'Online' : 'In person',
      after: newRow.is_online ? 'Online' : 'In person',
    })
  }
  if (
    newRow.is_online &&
    (oldRow.online_url ?? '') !== (newRow.online_url ?? '')
  ) {
    changes.push({
      label: 'Online link',
      before: oldRow.online_url,
      after: newRow.online_url,
    })
  }
  return changes
}

function authorize(request: Request): boolean {
  const expected = process.env.EVENT_CHANGE_WEBHOOK_SECRET
  if (!expected) return false
  const provided = request.headers.get('x-webhook-secret')
  return provided === expected
}

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://albago.org'

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = (await request.json()) as WebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (
    payload.table !== 'events' ||
    payload.schema !== 'public' ||
    payload.type !== 'UPDATE' ||
    !payload.record ||
    !payload.old_record
  ) {
    return NextResponse.json({ skipped: 'not_applicable' })
  }

  const oldRow = payload.old_record
  const newRow = payload.record
  const isCancelled =
    oldRow.status !== 'cancelled' && newRow.status === 'cancelled'

  const changes = diffEvent(oldRow, newRow)
  if (!isCancelled && changes.length === 0) {
    return NextResponse.json({ skipped: 'no_meaningful_change' })
  }

  const admin = createAdminClient()

  const savedRes = await admin
    .from('saved_events')
    .select('user_id')
    .eq('event_id', newRow.id)
  if (savedRes.error) {
    return NextResponse.json(
      { error: 'saved_events_query_failed', detail: savedRes.error.message },
      { status: 500 },
    )
  }

  const savedRows = (savedRes.data ?? []) as Array<{ user_id: string }>
  const userIds = savedRows.map((r) => r.user_id)
  if (userIds.length === 0) {
    return NextResponse.json({ sent: 0, reason: 'no_subscribers' })
  }

  const profileRes = await admin
    .from('profiles')
    .select('id, notification_preferences')
    .in('id', userIds)

  const profileRows = (profileRes.data ?? []) as Array<{
    id: string
    notification_preferences: Record<string, unknown> | null
  }>

  const optedIn = new Set(
    profileRows
      .filter((p) => {
        const prefs = p.notification_preferences ?? {}
        return prefs.saved_event_updates !== false
      })
      .map((p) => p.id),
  )

  const recipients: { email: string }[] = []
  for (const userId of userIds) {
    if (!optedIn.has(userId)) continue
    const { data: userResult } = await admin.auth.admin.getUserById(userId)
    const email = userResult?.user?.email
    if (email) recipients.push({ email })
  }

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, reason: 'all_opted_out' })
  }

  const { subject, html, text } = renderSavedEventChangedEmail({
    eventTitle: newRow.title,
    eventUrl: `${siteUrl}/events/${newRow.slug}`,
    changes,
    isCancelled,
    unsubscribeUrl: `${siteUrl}/dashboard/settings`,
  })

  const resend = getResend()
  const sendResults = await Promise.allSettled(
    recipients.map((r) =>
      resend.emails.send({
        from: FROM_ADDRESS,
        to: r.email,
        subject,
        html,
        text,
      }),
    ),
  )

  const sent = sendResults.filter((r) => r.status === 'fulfilled').length
  const failed = sendResults.length - sent

  return NextResponse.json({ sent, failed, isCancelled, changes: changes.length })
}
