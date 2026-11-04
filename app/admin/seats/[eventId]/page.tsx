import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/seats/errors'
import type {
  SeatAdminLogRow,
  SeatCategoryRow,
  SeatReservationRow,
  SeatSaleRow,
  SeatStockRow,
  SeatWaitlistRow,
} from '@/lib/seats/types'
import { adminPaymentView, type SeatPaymentSettings } from '@/lib/seats/payment'
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
  const [eventRes, saleRes, catRes, stockRes, resRes, waitRes, payRes, logRes, userRes] = await Promise.all([
    supabase.from('events').select('id, slug, title, date, time, status').eq('id', eventId).maybeSingle(),
    supabase.from('seat_sales').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('seat_categories').select('*').eq('event_id', eventId).order('sort_order').order('code'),
    supabase
      .from('seat_stock')
      .select('id, event_id, category, area, block, row_label, seat_number, withdrawn, withdrawn_reason, withdrawn_note, reservation_id')
      .eq('event_id', eventId)
      .order('area')
      .order('block')
      .order('row_label')
      .order('seat_number'),
    supabase.from('seat_reservations').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('seat_waitlist').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('seat_payment_settings').select('*').eq('event_id', eventId).maybeSingle(),
    supabase
      .from('seat_admin_log')
      .select('id, actor, action, detail, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.auth.getUser(),
  ])

  if (!eventRes.data || !saleRes.data) notFound()

  // Who made each logged change (admins only; falls back to "Admin").
  const log = (logRes.data as SeatAdminLogRow[] | null) ?? []
  const actorIds = [...new Set(log.map((l) => l.actor).filter((id): id is string => !!id))]
  const actors: Record<string, string> = {}
  if (actorIds.length > 0) {
    const { data: people } = await supabase.from('profiles').select('id, display_name').in('id', actorIds)
    for (const p of (people as Array<{ id: string; display_name: string | null }> | null) ?? []) {
      if (p.display_name) actors[p.id] = p.display_name
    }
  }

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
          // The full IBAN stays on the server; the console only shows it masked.
          payment: payRes.data ? adminPaymentView(payRes.data as SeatPaymentSettings) : null,
          log,
          actors,
          viewerId: userRes.data.user?.id ?? null,
        }}
      />
    </div>
  )
}
