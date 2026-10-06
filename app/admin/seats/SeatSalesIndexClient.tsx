'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Armchair, ChevronRight, Loader2, Plus, Search, TriangleAlert } from 'lucide-react'
import type { SeatSaleMode } from '@/lib/seats/types'

export type SaleSummary = {
  eventId: string
  mode: SeatSaleMode
  title: string
  slug: string
  date: string
  seats: number
  sold: number
  revenue: number
  held: number
  toTransfer: number
}

export type EventOption = { id: string; title: string; date: string; slug: string }

const eur = (cents: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100)

const MODE_PILL: Record<SeatSaleMode, string> = {
  draft: 'border-white/20 bg-white/[0.06] text-white/75',
  waitlist: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  live: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  closed: 'border-white/15 bg-white/[0.03] text-white/45',
}

/**
 * Seat sales index (phase 43): one card per event where AlbaGo sells its own
 * seat stock, plus "turn on seat sales" for any upcoming event.
 */
export default function SeatSalesIndexClient({
  sales,
  events,
  setupMissing,
}: {
  sales: SaleSummary[]
  events: EventOption[]
  setupMissing: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const matches = q
    ? events.filter((e) => e.title.toLowerCase().includes(q) || e.slug.includes(q)).slice(0, 12)
    : []

  const create = async (eventId: string) => {
    setBusyId(eventId)
    setError(null)
    try {
      const res = await fetch('/api/admin/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setError(`Could not turn on seat sales (${json?.error ?? res.status}).`)
        setBusyId(null)
        return
      }
      router.push(`/admin/seats/${eventId}`)
    } catch {
      setError('Could not reach the server.')
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/30">
            <Armchair className="h-4 w-4" />
          </span>
          <h1 className="text-lg font-semibold text-white">Seats</h1>
        </div>
        <p className="mt-2 text-sm text-white/55">
          Sell your own stock of seats for an event — paste the seat list from your Eventim account, set prices,
          and track every order from reservation to the Eventim transfer.
        </p>
      </header>

      {setupMissing && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100/90">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            The seat tables aren&apos;t in the database yet. Run <code className="font-mono">docs/seeds/phase-43-seat-sales.sql</code>{' '}
            in the Supabase SQL editor, then reload.
          </span>
        </div>
      )}

      {sales.length > 0 && (
        <ul className="mb-8 space-y-2.5">
          {sales.map((s) => (
            <li key={s.eventId}>
              <Link
                href={`/admin/seats/${s.eventId}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 transition hover:border-white/15 hover:bg-white/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{s.title}</p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {s.date &&
                      new Date(`${s.date}T12:00:00`).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase ${MODE_PILL[s.mode]}`}>
                  {s.mode}
                </span>
                <span className="text-xs tabular-nums text-white/65">
                  {s.sold}/{s.seats} sold · {eur(s.revenue)}
                  {s.held > 0 && ` · ${s.held} on hold`}
                </span>
                {s.toTransfer > 0 && (
                  <span className="rounded-full bg-flame-500 px-2 py-0.5 text-[11px] font-bold text-white">
                    {s.toTransfer} to transfer
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-white/35" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white">Sell seats for an event</h2>
        <p className="mt-1 text-xs text-white/50">
          Create the event first (Events → New) if it isn&apos;t on AlbaGo yet. Seat sales start as a private draft.
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search upcoming events, e.g. Kabayel"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-flame-500/40 focus:outline-none"
          />
        </div>
        {q && matches.length === 0 && <p className="mt-3 text-xs text-white/45">No upcoming event matches.</p>}
        {matches.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {matches.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{e.title}</p>
                  <p className="text-[11px] text-white/40">{e.date}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void create(e.id)}
                  disabled={!!busyId}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-flame-500 px-3 text-xs font-semibold text-white transition hover:bg-flame-400 disabled:opacity-50"
                >
                  {busyId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Sell seats
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-xs text-flame-200">{error}</p>}
      </section>
    </div>
  )
}
