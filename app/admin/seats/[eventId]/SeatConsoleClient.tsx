'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Armchair, ArrowLeft, ExternalLink } from 'lucide-react'
import { effectiveStatus } from '@/lib/seats/format'
import type { SeatSaleMode } from '@/lib/seats/types'
import ReservationsPanel from './ReservationsPanel'
import SettingsPanel from './SettingsPanel'
import StockPanel from './StockPanel'
import WaitlistPanel from './WaitlistPanel'
import { eur, type ConsoleData } from './consoleShared'

/**
 * Seat console (phase 43): everything to sell one event's seat stock —
 * orders + transfer queue, stock + pricing + seat map, sale settings, and the
 * waitlist. Every mutation calls /api/admin/seats/[eventId] and then
 * router.refresh(), so the server data stays the single source of truth.
 */

type Tab = 'orders' | 'stock' | 'settings' | 'waitlist'

const MODE_PILL: Record<SeatSaleMode, string> = {
  draft: 'border-white/20 bg-white/[0.06] text-white/75',
  waitlist: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  live: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  closed: 'border-white/15 bg-white/[0.03] text-white/45',
}

export default function SeatConsoleClient({ data }: { data: ConsoleData }) {
  const { event, sale, categories, stock, reservations, waitlist } = data
  const [tab, setTab] = useState<Tab>(stock.length === 0 ? 'stock' : 'orders')

  const kpis = useMemo(() => {
    const live = reservations.map((r) => ({ ...r, status: effectiveStatus(r.status, r.expires_at) }))
    const sold = live.filter((r) => ['paid', 'transfer_sent', 'delivered'].includes(r.status))
    const held = live.filter((r) => r.status === 'held')
    const faceByCat = new Map(categories.map((c) => [c.code, c.face_value_cents ?? 0]))
    return {
      seats: stock.filter((s) => !s.withdrawn).length,
      seatsSold: sold.reduce((n, r) => n + r.quantity, 0),
      seatsHeld: held.reduce((n, r) => n + r.quantity, 0),
      revenue: sold.reduce((n, r) => n + r.total_cents, 0),
      heldValue: held.reduce((n, r) => n + r.total_cents, 0),
      toTransfer: live.filter((r) => r.status === 'paid').length,
      delivered: live.filter((r) => r.status === 'delivered').reduce((n, r) => n + r.quantity, 0),
      stockFace: stock.reduce((n, s) => n + (faceByCat.get(s.category) ?? 0), 0),
    }
  }, [reservations, stock, categories])

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: 'orders', label: 'Orders', badge: kpis.toTransfer || undefined },
    { id: 'stock', label: 'Stock & prices' },
    { id: 'settings', label: 'Settings' },
    { id: 'waitlist', label: 'Waitlist', badge: waitlist.length || undefined },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/seats"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All seat sales
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/30">
              <Armchair className="h-4 w-4" />
            </span>
            <h1 className="truncate text-lg font-semibold text-white">{event.title}</h1>
          </div>
          <p className="mt-1.5 text-sm text-white/50">
            {new Date(`${event.date}T12:00:00`).toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {event.time ? ` · ${event.time.slice(0, 5)}` : ''}
            {event.status !== 'published' ? ` · event is ${event.status}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${MODE_PILL[sale.mode]}`}>
            {sale.mode}
          </span>
          <a
            href={`/events/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white/75 transition hover:bg-white/[0.07]"
          >
            Event page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi label="Seats sold" value={`${kpis.seatsSold} / ${kpis.seats}`} sub={`${kpis.delivered} delivered`} />
        <Kpi label="Revenue (paid)" value={eur(kpis.revenue, sale.currency)} sub={`${eur(kpis.stockFace, sale.currency)} face value of stock`} />
        <Kpi label="On hold" value={`${kpis.seatsHeld} seats`} sub={`${eur(kpis.heldValue, sale.currency)} awaiting payment`} />
        <Kpi label="To transfer" value={`${kpis.toTransfer}`} sub="paid orders not yet sent" highlight={kpis.toTransfer > 0} />
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className="rounded-full bg-flame-500 px-1.5 text-[10px] font-bold leading-4 text-white">{t.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === 'orders' && <ReservationsPanel data={data} />}
        {tab === 'stock' && <StockPanel data={data} />}
        {tab === 'settings' && <SettingsPanel data={data} />}
        {tab === 'waitlist' && <WaitlistPanel data={data} />}
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        highlight ? 'border-flame-500/40 bg-flame-500/[0.08]' : 'border-white/[0.07] bg-white/[0.02]'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-white/45">{sub}</p>
    </div>
  )
}
