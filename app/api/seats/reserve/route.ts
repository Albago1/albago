import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rateLimit'
import { cleanText, seatRpcError, UUID_RE } from '@/lib/seats/errors'
import { sendSeatEmail } from '@/lib/seats/sendSeatEmail'
import type { ReservationResult } from '@/lib/seats/types'

export const runtime = 'nodejs'
export const maxDuration = 20

// Seat reservation (phase 43). All correctness lives in seat_reserve: one
// transaction under the seat_sales row lock, seats picked so a group always
// sits together. This route only authenticates, validates shape, and maps RPC
// codes to stable JSON. No payment happens here — the reservation is 'held'
// until the seller confirms payment.

const limited = createRateLimiter(10 * 60_000, 12)

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId : ''
  const category = cleanText(body.category, 40)
  const quantity = typeof body.quantity === 'number' ? body.quantity : NaN
  if (!UUID_RE.test(eventId) || !category || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 })
  }
  if (limited(user.id)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const { data, error } = await supabase.rpc('seat_reserve', {
    p_event_id: eventId,
    p_category: category,
    p_quantity: quantity,
    p_buyer_name: cleanText(body.buyerName, 120),
    p_eventim_email: cleanText(body.eventimEmail, 254),
    p_phone: cleanText(body.phone, 40),
    p_note: cleanText(body.note, 500),
  })

  if (error) {
    const known = seatRpcError(error.message)
    if (known) return NextResponse.json({ error: known.code }, { status: known.status })
    console.error('[seats/reserve] rpc failed:', error.message)
    return NextResponse.json({ error: 'reserve_failed' }, { status: 500 })
  }

  const result = data as ReservationResult
  const emailBase = {
    reference: result.reference,
    status: result.status,
    buyer_name: cleanText(body.buyerName, 120) ?? '',
    buyer_email: user.email ?? '',
    eventim_email: (cleanText(body.eventimEmail, 254) ?? '').toLowerCase(),
    phone: cleanText(body.phone, 40),
    note: cleanText(body.note, 500),
    category_label: result.category_label,
    quantity: result.quantity,
    total_cents: result.total_cents,
    currency: result.currency,
    seats: result.seats,
    expires_at: result.expires_at,
  }
  // Best-effort, after commit: the buyer's confirmation and the seller's ping.
  const [emailed] = await Promise.all([
    sendSeatEmail(supabase, 'reserved', eventId, emailBase),
    sendSeatEmail(supabase, 'seller_new', eventId, emailBase),
  ])

  return NextResponse.json({ ...result, emailed })
}
