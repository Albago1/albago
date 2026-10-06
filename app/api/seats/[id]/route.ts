import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { seatRpcError, UUID_RE } from '@/lib/seats/errors'
import { sendSeatEmail } from '@/lib/seats/sendSeatEmail'
import type { SeatReservationRow } from '@/lib/seats/types'

export const runtime = 'nodejs'

// Buyer self-service on their own reservation: cancel an unpaid hold, or
// confirm the Eventim transfer arrived. Ownership is enforced inside
// seat_buyer_update (user_id = auth.uid()).

const ACTIONS = new Set(['cancel', 'confirm_received'])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: { action?: unknown }
  try {
    body = (await request.json()) as { action?: unknown }
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const action = typeof body.action === 'string' ? body.action : ''
  if (!UUID_RE.test(id) || !ACTIONS.has(action)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('seat_buyer_update', {
    p_reservation_id: id,
    p_action: action,
  })
  if (error) {
    const known = seatRpcError(error.message)
    if (known) return NextResponse.json({ error: known.code }, { status: known.status })
    console.error('[seats/:id] rpc failed:', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  if (action === 'cancel') {
    const { data: row } = await supabase
      .from('seat_reservations')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (row) {
      const r = row as SeatReservationRow
      await sendSeatEmail(supabase, 'cancelled', r.event_id, r)
    }
  }

  return NextResponse.json(data)
}
