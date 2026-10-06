import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { createClient } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/seats/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Turn seat sales on for an event (phase 43). Admin only. Starts in 'draft' —
 * nothing is public until the admin switches the mode.
 *   POST { eventId } → { ok }
 */
export async function POST(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  let body: { eventId?: unknown }
  try {
    body = (await request.json()) as { eventId?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  const eventId = typeof body.eventId === 'string' ? body.eventId : ''
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ ok: false, error: 'bad_event' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: event } = await supabase.from('events').select('id').eq('id', eventId).maybeSingle()
  if (!event) {
    return NextResponse.json({ ok: false, error: 'event_not_found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('seat_sales')
    .upsert({ event_id: eventId }, { onConflict: 'event_id', ignoreDuplicates: true })
  if (error) {
    console.error('[admin/seats] create failed:', error.message)
    return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
