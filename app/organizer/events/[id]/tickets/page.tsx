import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TicketsManagerClient, {
  type AttendeeRow,
  type TierStat,
  type TicketsEvent,
} from './TicketsManagerClient'

export const metadata: Metadata = {
  title: 'Tickets — Organizer',
}

// The tickets manager is always current (claims + check-ins land continuously),
// so never serve it from a static cache.
export const dynamic = 'force-dynamic'

type TierRow = {
  id: string
  name: string
  capacity: number
  price_cents: number
  status: 'active' | 'paused' | 'sold_out_manual' | 'archived'
  sort_order: number
}

type TicketRow = {
  id: string
  order_item_id: string | null
  tier_id: string
  serial: string
  attendee_name: string | null
  status: 'valid' | 'checked_in' | 'void' | 'refunded'
  checked_in_at: string | null
  created_at: string
}

/**
 * Stage F — Organizer tickets manager for ONE event. Server component: it does
 * the ownership guard and reads all sales data via the RLS-scoped policies
 * (organizer of the event, or admin), then hands plain rows to the client for
 * the interactive bits (void, pause, CSV). No new RPCs — reads are direct
 * selects the ticketing RLS already permits; the only writes are the existing
 * void_ticket / organizer_set_tier_status RPCs, called from the client.
 */
export default async function OrganizerEventTicketsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=/organizer/events/${id}/tickets`)

  // Load the event and confirm the caller may manage it (owner or admin).
  const [{ data: eventRow }, { data: profileRow }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, date, time, is_civic, organizer_id, status')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])

  const event = eventRow as
    | (TicketsEvent & { organizer_id: string | null })
    | null
  if (!event) notFound()

  const isAdmin = (profileRow as { role?: string | null } | null)?.role === 'admin'
  if (event.organizer_id !== user.id && !isAdmin) notFound()

  // Sales data. Tiers + tickets + orders are all filterable by event_id and are
  // RLS-readable by the owner; order_items bridges a ticket to its buyer email
  // and is fetched by the order ids we just loaded.
  const [{ data: tierRows }, { data: ticketRows }, { data: orderRows }] =
    await Promise.all([
      supabase
        .from('ticket_tiers')
        .select('id, name, capacity, price_cents, status, sort_order')
        .eq('event_id', id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('tickets')
        .select('id, order_item_id, tier_id, serial, attendee_name, status, checked_in_at, created_at')
        .eq('event_id', id)
        .order('created_at', { ascending: true }),
      supabase.from('orders').select('id, contact_email').eq('event_id', id),
    ])

  const tiers = (tierRows as TierRow[] | null) ?? []
  const tickets = (ticketRows as TicketRow[] | null) ?? []
  const orders = (orderRows as { id: string; contact_email: string | null }[] | null) ?? []

  // Bridge ticket → order_item → order to attach the buyer email to each ticket.
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

  // Tier naming needs ALL tiers (a ticket can point at an archived tier); the
  // tier CARDS below only show the live ones.
  const tierName = new Map(tiers.map((t) => [t.id, t.name]))

  // Per-tier counters. issued = admissions still counting toward capacity
  // (valid + checked_in), matching how the DB computes availability.
  const tierStats: TierStat[] = tiers
    .filter((t) => t.status !== 'archived')
    .map((t) => {
      const forTier = tickets.filter((tk) => tk.tier_id === t.id)
      const issued = forTier.filter((tk) => tk.status === 'valid' || tk.status === 'checked_in').length
      const checkedIn = forTier.filter((tk) => tk.status === 'checked_in').length
      return {
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        priceCents: t.price_cents,
        status: t.status,
        issued,
        checkedIn,
      }
    })

  const attendees: AttendeeRow[] = tickets.map((t) => {
    const orderId = t.order_item_id ? itemToOrder.get(t.order_item_id) : undefined
    return {
      ticketId: t.id,
      name: t.attendee_name,
      email: orderId ? orderEmail.get(orderId) ?? null : null,
      tierId: t.tier_id,
      tierName: tierName.get(t.tier_id) ?? 'Removed tier',
      serial: t.serial,
      status: t.status,
      claimedAt: t.created_at,
      checkedInAt: t.checked_in_at,
    }
  })

  return (
    <TicketsManagerClient
      event={{
        id: event.id,
        title: event.title,
        slug: event.slug,
        date: event.date,
        time: event.time,
        is_civic: event.is_civic,
        status: event.status,
      }}
      tiers={tierStats}
      attendees={attendees}
    />
  )
}
