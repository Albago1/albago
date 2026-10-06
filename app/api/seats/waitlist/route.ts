import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rateLimit'
import { cleanText, seatRpcError, UUID_RE } from '@/lib/seats/errors'

export const runtime = 'nodejs'

// "Tell me when seats go on sale" (phase 43). Open to signed-out visitors, so
// it is rate-limited per IP; seat_join_waitlist validates and de-duplicates
// by email.

const limited = createRateLimiter(10 * 60_000, 8)

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (limited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId : ''
  const quantity = typeof body.quantity === 'number' ? body.quantity : 1
  if (!UUID_RE.test(eventId) || !Number.isInteger(quantity)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('seat_join_waitlist', {
    p_event_id: eventId,
    p_name: cleanText(body.name, 120),
    p_email: cleanText(body.email, 254),
    p_phone: cleanText(body.phone, 40),
    p_category: cleanText(body.category, 40),
    p_quantity: quantity,
    p_city: cleanText(body.city, 80),
  })

  if (error) {
    const known = seatRpcError(error.message)
    if (known) return NextResponse.json({ error: known.code }, { status: known.status })
    console.error('[seats/waitlist] rpc failed:', error.message)
    return NextResponse.json({ error: 'waitlist_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
