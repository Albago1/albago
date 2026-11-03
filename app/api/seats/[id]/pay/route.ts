import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_RE } from '@/lib/seats/errors'
import { epcPayload, paypalMeUrl, type SeatPaymentSettings, type SeatPaymentView } from '@/lib/seats/payment'

export const runtime = 'nodejs'

/**
 * GET /api/seats/[id]/pay — how to pay for one held reservation.
 *
 * Only the buyer who owns the reservation, and only while it's held and
 * unpaid. The seller's bank name and IBAN never leave the server as text:
 * they go into the GiroCode image (drawn here) that the buyer's banking app
 * reads. seat_payment_settings is admin-only, so it's read with the service
 * role after the ownership check.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  // RLS lets a buyer read only their own reservations; the user_id check makes that explicit.
  const { data: row } = await supabase
    .from('seat_reservations')
    .select('id, event_id, user_id, reference, status, total_cents, currency, expires_at')
    .eq('id', id)
    .maybeSingle()
  const r = row as {
    event_id: string
    user_id: string | null
    reference: string
    status: string
    total_cents: number
    currency: string
    expires_at: string | null
  } | null
  if (!r || r.user_id !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (r.status !== 'held' || (r.expires_at && Date.parse(r.expires_at) <= Date.now())) {
    return NextResponse.json({ error: 'not_payable' }, { status: 409 })
  }

  const { data: settings } = await createAdminClient()
    .from('seat_payment_settings')
    .select('*')
    .eq('event_id', r.event_id)
    .maybeSingle()
  const s = settings as SeatPaymentSettings | null

  const qr =
    s?.bank_holder && s.iban && r.currency === 'EUR'
      ? await QRCode.toDataURL(
          epcPayload({ holder: s.bank_holder, iban: s.iban, bic: s.bic, amountCents: r.total_cents, remittance: r.reference }),
          { errorCorrectionLevel: 'M', margin: 2, width: 512, color: { dark: '#000000', light: '#ffffff' } },
        )
      : null
  const paypal = s?.paypal_me ? paypalMeUrl(s.paypal_me, r.total_cents, r.currency) : null

  const view: SeatPaymentView = {
    reference: r.reference,
    amount_cents: r.total_cents,
    currency: r.currency,
    expires_at: r.expires_at,
    qr,
    paypal,
  }
  return NextResponse.json(view, { headers: { 'Cache-Control': 'private, no-store' } })
}
