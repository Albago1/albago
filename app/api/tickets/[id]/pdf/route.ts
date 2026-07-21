import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signTicketToken } from '@/lib/tickets/qrToken'
import { buildTicketPdf } from '@/lib/tickets/ticketPdf'
import {
  TICKET_EVENT_SELECT,
  ticketArtUrl,
  ticketDateLabel,
  ticketTimeLabel,
  ticketVenueLine,
  type TicketEventRow,
} from '@/lib/tickets/ticketLabels'

export const runtime = 'nodejs'
export const maxDuration = 30

// Poster-grade PDF of one ticket (Phase 33). RLS scopes the read: the ticket
// owner, the event's organizer, and admins can download; everyone else sees
// 404. The signed QR token is minted here — never stored, never client-built.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type TicketRow = {
  id: string
  serial: string
  status: string
  qr_version: number
  event_id: string
  ticket_tiers: { name: string } | null
  events: TicketEventRow | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 })
  }

  const { data } = await supabase
    .from('tickets')
    .select(
      `id, serial, status, qr_version, event_id, ticket_tiers ( name ), events ( ${TICKET_EVENT_SELECT} )`,
    )
    .eq('id', id)
    .maybeSingle()

  const ticket = data as unknown as TicketRow | null
  if (!ticket || !ticket.events) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (ticket.status !== 'valid' && ticket.status !== 'checked_in') {
    return NextResponse.json({ error: 'ticket_not_active' }, { status: 410 })
  }

  const ev = ticket.events
  const token = signTicketToken(ticket.event_id, ticket.id, ticket.qr_version)
  const pdf = await buildTicketPdf({
    eventTitle: ev.title,
    dateLabel: ticketDateLabel(ev.date),
    timeLabel: ticketTimeLabel(ev.time, ev.end_time),
    venueLine: ticketVenueLine(ev),
    addressLine: ev.is_online ? null : ev.address,
    eventUrl: `https://www.albago.org/events/${ev.slug}`,
    artUrl: ticketArtUrl(ev),
    tickets: [
      {
        serial: ticket.serial,
        token,
        tierName: ticket.ticket_tiers?.name ?? null,
      },
    ],
  })

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="albago-ticket-${ticket.serial}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
