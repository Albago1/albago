import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_RE } from '@/lib/seats/errors'
import { formatMoney, seatsLine } from '@/lib/seats/format'
import { languageLocales } from '@/lib/i18n/config'
import type { SeatReservationRow } from '@/lib/seats/types'
import {
  SEAT_WORDS,
  asWaLang,
  buyerAskMessage,
  buyerOrderMessage,
  buyerPaidMessage,
  waLink,
} from '@/lib/seats/whatsapp'

export const runtime = 'nodejs'

/**
 * GET /api/seats/whatsapp?event=…&ctx=ask|paid|order&lang=…[&r=reservationId][&seats=…]
 *
 * Opens a WhatsApp chat with the seller, message already written, by
 * redirecting to wa.me. The seller's number lives only in the admin-only
 * seat_payment_settings, so it never appears in a page — it shows up once
 * the chat opens, which WhatsApp can't avoid.
 *   ask   — anyone (if the seller allows it), optionally naming picked seats
 *   paid  — the buyer of a reservation: reference, amount, seats, Eventim email
 *   order — the buyer of a reservation: a question about it
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const eventId = url.searchParams.get('event') ?? ''
  const ctx = url.searchParams.get('ctx') ?? 'ask'
  const lang = asWaLang(url.searchParams.get('lang'))
  const reservationId = url.searchParams.get('r') ?? ''
  const seatsText = (url.searchParams.get('seats') ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin), { status: 303 })

  if (!UUID_RE.test(eventId) || !['ask', 'paid', 'order'].includes(ctx)) return back('/')

  const admin = createAdminClient()
  const [{ data: settings }, { data: event }, { data: sale }] = await Promise.all([
    admin.from('seat_payment_settings').select('whatsapp, whatsapp_public').eq('event_id', eventId).maybeSingle(),
    admin.from('events').select('slug, title').eq('id', eventId).maybeSingle(),
    admin.from('seat_sales').select('seller_name').eq('event_id', eventId).maybeSingle(),
  ])
  const s = settings as { whatsapp: string | null; whatsapp_public: boolean } | null
  const ev = event as { slug: string; title: string } | null
  if (!s?.whatsapp || !ev) return back(ev ? `/events/${ev.slug}` : '/')
  const seller = (sale as { seller_name: string | null } | null)?.seller_name || 'AlbaGo'

  // Who's asking: needed for reservation messages, and for questions when
  // the seller only takes them from buyers.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let text: string
  if (ctx === 'ask') {
    if (!s.whatsapp_public) {
      const { count } = await supabase
        .from('seat_reservations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('user_id', user?.id ?? '00000000-0000-0000-0000-000000000000')
      if (!user || !count) return back(`/events/${ev.slug}`)
    }
    text = buyerAskMessage(lang, { seller, event: ev.title, seats: seatsText || null })
  } else {
    if (!user) return back(`/sign-in?next=${encodeURIComponent('/dashboard/seats')}`)
    if (!UUID_RE.test(reservationId)) return back('/dashboard/seats')
    // RLS: a buyer reads only their own reservations.
    const { data: row } = await supabase.from('seat_reservations').select('*').eq('id', reservationId).maybeSingle()
    const r = row as SeatReservationRow | null
    if (!r || r.user_id !== user.id || r.event_id !== eventId) return back('/dashboard/seats')
    text =
      ctx === 'paid'
        ? buyerPaidMessage(lang, {
            seller,
            event: ev.title,
            reference: r.reference,
            amount: formatMoney(r.total_cents, r.currency, languageLocales[lang]),
            seats: seatsLine(r.seats, SEAT_WORDS[lang]),
            eventimEmail: r.eventim_email,
          })
        : buyerOrderMessage(lang, { seller, event: ev.title, reference: r.reference })
  }

  const res = NextResponse.redirect(waLink(s.whatsapp, text), { status: 302 })
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}
