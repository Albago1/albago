import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTicketConfirmationEmail } from '@/lib/tickets/sendTicketEmail'

export const runtime = 'nodejs'
// PDF generation + artwork fetch for the confirmation email can take a few
// seconds on top of the claim itself.
export const maxDuration = 30

// Free-ticket claim (TIX-1 Stage C). All correctness lives in the
// claim_free_tickets RPC — one transaction, tier row locked FOR UPDATE, so a
// sold-out race can never oversell. This route only authenticates, validates
// shape, and translates RPC error codes into stable JSON the client maps ×4.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// RPC RAISE EXCEPTION codes → HTTP status. Anything unknown is a 500 so real
// failures never masquerade as polite user-facing states.
const KNOWN_ERRORS: Record<string, number> = {
  auth_required: 401,
  bad_quantity: 400,
  tier_not_found: 404,
  event_not_published: 409,
  civic_not_ticketed: 409,
  event_cancelled: 409,
  event_ended: 409,
  tier_not_active: 409,
  tier_not_available: 409,
  paid_not_available: 409,
  sales_not_started: 409,
  sales_ended: 409,
  over_max_per_order: 409,
  user_cap_reached: 409,
  sold_out: 409,
}

type ClaimResult = {
  ok: boolean
  order_id: string
  event_id: string
  tickets: Array<{ id: string; serial: string }>
}

export async function POST(request: Request) {
  let body: { tierId?: unknown; quantity?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const tierId = typeof body.tierId === 'string' ? body.tierId : ''
  const quantity = typeof body.quantity === 'number' ? body.quantity : NaN
  if (!UUID_RE.test(tierId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('claim_free_tickets', {
    p_tier_id: tierId,
    p_quantity: quantity,
  })

  if (error) {
    const code = error.message in KNOWN_ERRORS ? error.message : null
    if (code) {
      return NextResponse.json({ error: code }, { status: KNOWN_ERRORS[code] })
    }
    console.error('[tickets/claim] rpc failed:', error.message)
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }

  // Stage E: confirmation email (PDF + .ics attached), strictly best-effort
  // AFTER the claim transaction committed — a mail hiccup never unclaims.
  const result = data as ClaimResult
  let emailed = false
  if (user.email) {
    emailed = await sendTicketConfirmationEmail(supabase, {
      toEmail: user.email,
      eventId: result.event_id,
      orderId: result.order_id,
      tierId,
      tickets: result.tickets,
    })
  }

  return NextResponse.json({ ...result, emailed })
}
