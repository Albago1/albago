import type { SupabaseClient } from '@supabase/supabase-js'
import { getResend, FROM_ADDRESS } from '@/lib/email/resend'
import {
  renderSeatEmail,
  type SeatEmailData,
  type SeatEmailKind,
} from '@/lib/email/templates/seatReservation'
import {
  TICKET_EVENT_SELECT,
  ticketDateLabel,
  ticketTimeLabel,
  ticketVenueLine,
  type TicketEventRow,
} from '@/lib/tickets/ticketLabels'
import { formatMoney, seatsLine } from './format'
import type { SeatRef } from './types'

const SITE = 'https://www.albago.org'

export type SeatEmailReservation = {
  reference: string
  status: string
  buyer_name: string
  buyer_email: string
  eventim_email: string
  phone: string | null
  note: string | null
  category_label: string
  quantity: number
  total_cents: number
  currency: string
  seats: SeatRef[]
  expires_at: string | null
}

function berlinLabel(iso: string, withTime: boolean): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/**
 * Seat-sale emails, strictly best-effort AFTER the database change committed:
 * a mail hiccup must never undo a reservation, so this logs and returns false
 * instead of throwing. The buyer always sees the truth on My Seats.
 */
export async function sendSeatEmail(
  supabase: SupabaseClient,
  kind: SeatEmailKind,
  eventId: string,
  reservation: SeatEmailReservation,
): Promise<boolean> {
  const to =
    kind === 'seller_new' ? process.env.SEAT_SALES_NOTIFY_EMAIL?.trim() : reservation.buyer_email
  if (!to) return false
  try {
    const [{ data: eventData }, { data: saleData }] = await Promise.all([
      supabase.from('events').select(TICKET_EVENT_SELECT).eq('id', eventId).maybeSingle(),
      supabase.rpc('seat_sale_public', { p_event_id: eventId }),
    ])
    const ev = eventData as unknown as TicketEventRow | null
    if (!ev) return false
    const sale = saleData as { deliver_by: string | null; seller_name: string | null } | null

    const timeLabel = ticketTimeLabel(ev.time, ev.end_time)
    const dateLabel = ticketDateLabel(ev.date)
    const data: SeatEmailData = {
      eventTitle: ev.title,
      kicker: timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel,
      venueLine: ticketVenueLine(ev),
      reference: reservation.reference,
      buyerName: reservation.buyer_name,
      categoryLabel: reservation.category_label,
      quantity: reservation.quantity,
      seatsLine: seatsLine(reservation.seats),
      totalLabel: formatMoney(reservation.total_cents, reservation.currency),
      eventimEmail: reservation.eventim_email,
      holdUntilLabel: reservation.expires_at ? berlinLabel(reservation.expires_at, true) : null,
      deliverByLabel: sale?.deliver_by ? berlinLabel(`${sale.deliver_by}T12:00:00Z`, false) : null,
      sellerName: sale?.seller_name ?? null,
      trackerUrl: `${SITE}/dashboard/seats`,
      eventUrl: `${SITE}/events/${ev.slug}`,
      adminUrl: `${SITE}/admin/seats/${eventId}`,
      buyerEmail: reservation.buyer_email,
      phone: reservation.phone,
      note: reservation.note,
    }

    const { subject, html, text } = renderSeatEmail(kind, data)
    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text,
      ...(kind === 'seller_new' ? { replyTo: reservation.buyer_email } : {}),
    })
    if (error) {
      console.warn('[sendSeatEmail] resend error:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[sendSeatEmail] failed:', e instanceof Error ? e.message : e)
    return false
  }
}
