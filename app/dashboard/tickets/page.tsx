import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import MyTicketsClient, {
  type TicketCardData,
} from '@/components/dashboard/MyTicketsClient'
import { signTicketToken } from '@/lib/tickets/qrToken'
import { getLocationBySlug } from '@/lib/locations'

// My Tickets (TIX-1 Stage D). QR tokens are signed here on the server — the
// master TICKET_QR_SECRET and the signing path never reach the client; the
// browser only ever sees finished data-URL images of the signed tokens.

export const metadata: Metadata = {
  title: 'My Tickets — AlbaGo',
  robots: { index: false, follow: false },
}

type TicketRow = {
  id: string
  serial: string
  status: string
  qr_version: number
  event_id: string
  created_at: string
  ticket_tiers: { name: string } | null
  events: {
    slug: string
    title: string
    title_i18n: Record<string, string> | null
    date: string
    end_date: string | null
    time: string | null
    location_slug: string
    country: string | null
    banner_url: string | null
    gallery_urls: string[] | null
    is_online: boolean | null
    places: { name: string } | null
  } | null
}

function cityLabel(locationSlug: string): string {
  const fallback = getLocationBySlug(locationSlug)
  if (fallback.slug === locationSlug) return fallback.label
  return locationSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function MyTicketsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/sign-in?next=/dashboard/tickets')
  }

  const { data } = await supabase
    .from('tickets')
    .select(
      'id, serial, status, qr_version, event_id, created_at, ticket_tiers ( name ), events ( slug, title, title_i18n, date, end_date, time, location_slug, country, banner_url, gallery_urls, is_online, places ( name ) )',
    )
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (data as unknown as TicketRow[] | null) ?? []
  const todayIso = new Date().toISOString().slice(0, 10)

  const tickets: TicketCardData[] = []
  for (const row of rows) {
    const ev = row.events
    if (!ev) continue // event deleted/unpublished — nothing meaningful to render

    let qrDataUrl: string | null = null
    if (row.status === 'valid' || row.status === 'checked_in') {
      try {
        const token = signTicketToken(row.event_id, row.id, row.qr_version)
        qrDataUrl = await QRCode.toDataURL(token, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 640,
        })
      } catch {
        qrDataUrl = null // missing TICKET_QR_SECRET — card still renders
      }
    }

    tickets.push({
      id: row.id,
      serial: row.serial,
      status: row.status,
      tierName: row.ticket_tiers?.name ?? null,
      qrDataUrl,
      isPast: (ev.end_date ?? ev.date) < todayIso,
      event: {
        slug: ev.slug,
        title: ev.title,
        titleI18n: ev.title_i18n,
        date: ev.date,
        time: ev.time,
        city: cityLabel(ev.location_slug),
        country: ev.country,
        venueName: ev.places?.name ?? null,
        isOnline: !!ev.is_online,
        art: ev.banner_url ?? ev.gallery_urls?.[0] ?? null,
      },
    })
  }

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-28">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <MyTicketsClient tickets={tickets} />
      </div>
    </main>
  )
}
