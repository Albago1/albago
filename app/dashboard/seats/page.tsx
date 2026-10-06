import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import MySeatsClient, { type MySeatCard } from '@/components/seats/MySeatsClient'
import { cityLabelFromSlug } from '@/lib/tickets/ticketLabels'
import type { PublicSeatSale, SeatReservationRow } from '@/lib/seats/types'

// My Seats (phase 43): the buyer's tracker from reservation to the Eventim
// app. RLS returns only the signed-in buyer's own reservations.

export const metadata: Metadata = {
  title: 'My Seats — AlbaGo',
  robots: { index: false, follow: false },
}

type EventRow = {
  id: string
  slug: string
  title: string
  title_i18n: Record<string, string> | null
  date: string
  time: string | null
  location_slug: string
  country: string | null
  banner_url: string | null
  gallery_urls: string[] | null
  places: { name: string } | null
}

export default async function MySeatsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const { new: newId } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent('/dashboard/seats')}`)
  }

  const { data } = await supabase
    .from('seat_reservations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  const reservations = (data as SeatReservationRow[] | null) ?? []

  const eventIds = [...new Set(reservations.map((r) => r.event_id))]
  const [{ data: eventData }, sales] = await Promise.all([
    eventIds.length
      ? supabase
          .from('events')
          .select(
            'id, slug, title, title_i18n, date, time, location_slug, country, banner_url, gallery_urls, places ( name )',
          )
          .in('id', eventIds)
      : Promise.resolve({ data: [] }),
    Promise.all(
      eventIds.map(async (id) => {
        const { data: sale } = await supabase.rpc('seat_sale_public', { p_event_id: id })
        return [id, sale as PublicSeatSale | null] as const
      }),
    ),
  ])
  const events = new Map(((eventData as unknown as EventRow[] | null) ?? []).map((e) => [e.id, e]))
  const saleByEvent = new Map(sales)

  const cards: MySeatCard[] = reservations.map((r) => {
    const ev = events.get(r.event_id) ?? null
    const sale = saleByEvent.get(r.event_id) ?? null
    return {
      reservation: r,
      deliverBy: sale?.deliver_by ?? null,
      sellerName: sale?.seller_name ?? null,
      event: ev
        ? {
            slug: ev.slug,
            title: ev.title,
            titleI18n: ev.title_i18n,
            date: ev.date,
            time: ev.time,
            venue: [ev.places?.name, cityLabelFromSlug(ev.location_slug)].filter(Boolean).join(' · '),
            art: ev.banner_url ?? ev.gallery_urls?.[0] ?? null,
          }
        : null,
    }
  })

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <MySeatsClient cards={cards} newId={newId ?? null} />
      </div>
    </main>
  )
}
