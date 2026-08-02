import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deriveEventKeyB64 } from '@/lib/tickets/qrToken'
import DoorScannerClient, {
  type DoorAttendee,
  type DoorEvent,
} from './DoorScannerClient'

export const metadata: Metadata = {
  title: 'Door mode — Organizer',
}

export const dynamic = 'force-dynamic'

type TicketRow = {
  id: string
  order_item_id: string | null
  tier_id: string
  serial: string
  attendee_name: string | null
  status: 'valid' | 'checked_in' | 'void' | 'refunded'
  checked_in_at: string | null
}

/**
 * Stage G — Door mode (TIX-2). Server component: ownership guard, then it
 * derives THIS event's door key (k_event) from the master secret that never
 * leaves the server and hands only that per-event key to the scanner. Also
 * preloads the attendee list so the manual search fallback works without a
 * round-trip. The live check-in verdicts run through check_in_ticket.
 */
export default async function OrganizerEventDoorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=/organizer/events/${id}/door`)

  const [{ data: eventRow }, { data: profileRow }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, date, time, organizer_id')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])

  const event = eventRow as (DoorEvent & { organizer_id: string | null }) | null
  if (!event) notFound()

  const isAdmin = (profileRow as { role?: string | null } | null)?.role === 'admin'
  if (event.organizer_id !== user.id && !isAdmin) notFound()

  // The door key. If the server secret isn't configured the scanner can't verify
  // signatures — surface that honestly rather than crash the page.
  let kEvent: string | null = null
  try {
    kEvent = deriveEventKeyB64(event.id)
  } catch {
    kEvent = null
  }

  // Attendees for the manual-search fallback (valid + checked-in only — voided
  // and refunded tickets can't be admitted). Same read the tickets manager uses.
  const [{ data: tierRows }, { data: ticketRows }, { data: orderRows }] =
    await Promise.all([
      supabase.from('ticket_tiers').select('id, name').eq('event_id', id),
      supabase
        .from('tickets')
        .select('id, order_item_id, tier_id, serial, attendee_name, status, checked_in_at')
        .eq('event_id', id)
        .in('status', ['valid', 'checked_in'])
        .order('attendee_name', { ascending: true }),
      supabase.from('orders').select('id, contact_email').eq('event_id', id),
    ])

  const tierName = new Map(
    ((tierRows as { id: string; name: string }[] | null) ?? []).map((t) => [t.id, t.name]),
  )
  const tickets = (ticketRows as TicketRow[] | null) ?? []
  const orders = (orderRows as { id: string; contact_email: string | null }[] | null) ?? []
  const orderEmail = new Map(orders.map((o) => [o.id, o.contact_email]))

  const orderItemIds = [...new Set(tickets.map((t) => t.order_item_id).filter((v): v is string => !!v))]
  const itemToOrder = new Map<string, string>()
  if (orderItemIds.length > 0) {
    const { data: itemRows } = await supabase
      .from('order_items')
      .select('id, order_id')
      .in('id', orderItemIds)
    for (const it of (itemRows as { id: string; order_id: string }[] | null) ?? []) {
      itemToOrder.set(it.id, it.order_id)
    }
  }

  const attendees: DoorAttendee[] = tickets.map((t) => {
    const orderId = t.order_item_id ? itemToOrder.get(t.order_item_id) : undefined
    return {
      ticketId: t.id,
      name: t.attendee_name,
      email: orderId ? orderEmail.get(orderId) ?? null : null,
      serial: t.serial,
      tierName: tierName.get(t.tier_id) ?? '',
      status: t.status === 'checked_in' ? 'checked_in' : 'valid',
      checkedInAt: t.checked_in_at,
    }
  })

  const issued = attendees.length
  const checkedIn = attendees.filter((a) => a.status === 'checked_in').length

  return (
    <DoorScannerClient
      event={{ id: event.id, title: event.title, date: event.date, time: event.time }}
      kEvent={kEvent}
      attendees={attendees}
      initialStats={{ issued, checkedIn }}
    />
  )
}
