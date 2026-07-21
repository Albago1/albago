import type { SupabaseClient } from '@supabase/supabase-js'
import { getResend, FROM_ADDRESS } from '@/lib/email/resend'
import { renderTicketConfirmationEmail } from '@/lib/email/templates/ticketConfirmation'
import { signTicketToken } from '@/lib/tickets/qrToken'
import { buildTicketPdf } from '@/lib/tickets/ticketPdf'
import { buildEventIcs } from '@/lib/tickets/ics'
import {
  TICKET_EVENT_SELECT,
  ticketArtUrl,
  ticketDateLabel,
  ticketTimeLabel,
  ticketVenueLine,
  type TicketEventRow,
} from '@/lib/tickets/ticketLabels'

/**
 * Ticket confirmation email (TIX Stage E): PDF (one page per ticket) + .ics
 * attached, sent AFTER the claim transaction committed — never inside it.
 * Callers must treat this as best-effort: a mail failure can't unclaim
 * tickets, so it logs and returns false instead of throwing.
 */
export async function sendTicketConfirmationEmail(
  supabase: SupabaseClient,
  input: {
    toEmail: string
    eventId: string
    orderId: string
    tierId: string
    tickets: Array<{ id: string; serial: string }>
  },
): Promise<boolean> {
  try {
    const [{ data: eventData }, { data: tierData }] = await Promise.all([
      supabase
        .from('events')
        .select(TICKET_EVENT_SELECT)
        .eq('id', input.eventId)
        .maybeSingle(),
      supabase
        .from('ticket_tiers')
        .select('name')
        .eq('id', input.tierId)
        .maybeSingle(),
    ])
    const ev = eventData as unknown as TicketEventRow | null
    if (!ev) return false
    const tierName = (tierData as { name: string } | null)?.name ?? null

    const dateLabel = ticketDateLabel(ev.date)
    const timeLabel = ticketTimeLabel(ev.time, ev.end_time)
    const kicker = timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel
    const venueLine = ticketVenueLine(ev)
    const eventUrl = `https://www.albago.org/events/${ev.slug}`

    const pdf = await buildTicketPdf({
      eventTitle: ev.title,
      dateLabel,
      timeLabel,
      venueLine,
      addressLine: ev.is_online ? null : ev.address,
      eventUrl,
      artUrl: ticketArtUrl(ev),
      tickets: input.tickets.map((ticket) => ({
        serial: ticket.serial,
        // Freshly claimed tickets are always qr_version 1 (insert default);
        // rotation only ever bumps existing tickets.
        token: signTicketToken(input.eventId, ticket.id, 1),
        tierName,
      })),
    })

    const ics = buildEventIcs({
      uid: `${input.orderId}@albago.org`,
      title: ev.title,
      description: `Your AlbaGo ticket${input.tickets.length > 1 ? 's' : ''}: ${input.tickets
        .map((t) => t.serial)
        .join(', ')}`,
      date: ev.date,
      time: ev.time,
      endDate: ev.end_date,
      endTime: ev.end_time,
      timezone: ev.timezone,
      location: ev.is_online ? 'Online' : [ev.places?.name, ev.address].filter(Boolean).join(', ') || venueLine,
      lat: ev.lat,
      lng: ev.lng,
      url: eventUrl,
    })

    const { subject, html, text } = renderTicketConfirmationEmail({
      eventTitle: ev.title,
      kicker,
      venueLine,
      serials: input.tickets.map((t) => t.serial),
      eventUrl,
      myTicketsUrl: 'https://www.albago.org/dashboard/tickets',
    })

    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: input.toEmail,
      subject,
      html,
      text,
      attachments: [
        {
          filename: `albago-ticket${input.tickets.length > 1 ? 's' : ''}-${input.tickets[0].serial}.pdf`,
          content: Buffer.from(pdf).toString('base64'),
        },
        { filename: 'event.ics', content: Buffer.from(ics).toString('base64') },
      ],
    })
    if (error) {
      console.warn('[sendTicketConfirmationEmail] resend error:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn(
      '[sendTicketConfirmationEmail] failed:',
      e instanceof Error ? e.message : e,
    )
    return false
  }
}
