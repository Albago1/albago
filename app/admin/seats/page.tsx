import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import SeatSalesIndexClient, { type SaleSummary, type EventOption } from './SeatSalesIndexClient'

export const metadata: Metadata = {
  title: 'Admin · Seats',
}

// Auth + admin role are enforced by app/admin/layout.tsx. Fails soft to an
// empty list (with a setup hint) if the phase-43 SQL isn't applied yet.
export const dynamic = 'force-dynamic'

type SaleRow = {
  event_id: string
  mode: SaleSummary['mode']
  events: { title: string; slug: string; date: string } | null
}
type StockRow = { event_id: string; withdrawn: boolean }
type ReservationRow = {
  event_id: string
  status: string
  quantity: number
  total_cents: number
  expires_at: string | null
}

function summarize(sales: SaleRow[], stock: StockRow[], reservations: ReservationRow[]): SaleSummary[] {
  const now = Date.now()
  return sales.map((s) => {
    const mine = reservations.filter((r) => r.event_id === s.event_id)
    const sold = mine.filter((r) => ['paid', 'transfer_sent', 'delivered'].includes(r.status))
    return {
      eventId: s.event_id,
      mode: s.mode,
      title: s.events?.title ?? 'Unknown event',
      slug: s.events?.slug ?? '',
      date: s.events?.date ?? '',
      seats: stock.filter((x) => x.event_id === s.event_id && !x.withdrawn).length,
      sold: sold.reduce((n, r) => n + r.quantity, 0),
      revenue: sold.reduce((n, r) => n + r.total_cents, 0),
      // A lapsed hold no longer blocks seats, even before the sweep flips it.
      held: mine
        .filter((r) => r.status === 'held' && !(r.expires_at && Date.parse(r.expires_at) <= now))
        .reduce((n, r) => n + r.quantity, 0),
      toTransfer: mine.filter((r) => r.status === 'paid').length,
    }
  })
}

export default async function SeatSalesPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [salesRes, stockRes, resRes, eventsRes] = await Promise.all([
    supabase.from('seat_sales').select('event_id, mode, events ( title, slug, date )'),
    supabase.from('seat_stock').select('event_id, withdrawn'),
    supabase.from('seat_reservations').select('event_id, status, quantity, total_cents, expires_at'),
    supabase
      .from('events')
      .select('id, title, date, slug')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(400),
  ])

  const sales = (salesRes.data as unknown as SaleRow[] | null) ?? []
  const stock = (stockRes.data as StockRow[] | null) ?? []
  const reservations = (resRes.data as ReservationRow[] | null) ?? []

  const summaries = summarize(sales, stock, reservations)

  const withSale = new Set(sales.map((s) => s.event_id))
  const events: EventOption[] = ((eventsRes.data as EventOption[] | null) ?? []).filter((e) => !withSale.has(e.id))

  return (
    <div className="px-4 py-6 sm:px-6">
      <SeatSalesIndexClient sales={summaries} events={events} setupMissing={!!salesRes.error} />
    </div>
  )
}
