import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/seats/errors'
import type {
  SeatCategoryRow,
  SeatReservationRow,
  SeatSaleRow,
  SeatStockRow,
  SeatWaitlistRow,
} from '@/lib/seats/types'
import SeatConsoleClient from './SeatConsoleClient'
import type { ConsoleEvent } from './consoleShared'

export const metadata: Metadata = {
  title: 'Admin · Seat console',
}

// Auth + admin role are enforced by app/admin/layout.tsx; every table read
// here goes through the admin RLS policies of the phase-43 seed.
export const dynamic = 'force-dynamic'

export default async function SeatConsolePage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  if (!UUID_RE.test(eventId)) notFound()

  const supabase = await createClient()
  const [eventRes, saleRes, catRes, stockRes, resRes, waitRes] = await Promise.all([
    supabase.from('events').select('id, slug, title, date, time, status').eq('id', eventId).maybeSingle(),
    supabase.from('seat_sales').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('seat_categories').select('*').eq('event_id', eventId).order('sort_order').order('code'),
    supabase
      .from('seat_stock')
      .select('id, event_id, category, area, block, row_label, seat_number, withdrawn, reservation_id')
      .eq('event_id', eventId)
      .order('area')
      .order('block')
      .order('row_label')
      .order('seat_number'),
    supabase.from('seat_reservations').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('seat_waitlist').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
  ])

  if (!eventRes.data || !saleRes.data) notFound()

  return (
    <div className="px-4 py-6 sm:px-6">
      <SeatConsoleClient
        data={{
          event: eventRes.data as ConsoleEvent,
          sale: saleRes.data as SeatSaleRow,
          categories: (catRes.data as SeatCategoryRow[] | null) ?? [],
          stock: (stockRes.data as SeatStockRow[] | null) ?? [],
          reservations: (resRes.data as SeatReservationRow[] | null) ?? [],
          waitlist: (waitRes.data as SeatWaitlistRow[] | null) ?? [],
        }}
      />
    </div>
  )
}
