'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Download,
  Loader2,
  Pause,
  Play,
  ScanLine,
  Search,
  Ticket,
  Users,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/browser'
import { formatEventDateLabel, formatEventTimeLabel } from '@/lib/dateFilters'

export type TicketsEvent = {
  id: string
  title: string
  slug: string
  date: string
  time: string | null
  is_civic: boolean | null
  status: string
}

export type TierStat = {
  id: string
  name: string
  capacity: number
  priceCents: number
  status: 'active' | 'paused' | 'sold_out_manual' | 'archived'
  issued: number
  checkedIn: number
}

export type AttendeeRow = {
  ticketId: string
  name: string | null
  email: string | null
  tierId: string
  tierName: string
  serial: string
  status: 'valid' | 'checked_in' | 'void' | 'refunded'
  claimedAt: string
  checkedInAt: string | null
}

type StatusFilter = 'all' | 'valid' | 'checked_in' | 'void'

const STATUS_STYLE: Record<AttendeeRow['status'], string> = {
  valid: 'border-flame-500/30 bg-flame-500/10 text-flame-300',
  checked_in: 'border-green-500/25 bg-green-500/10 text-green-400',
  void: 'border-white/10 bg-white/[0.03] text-white/40',
  refunded: 'border-white/10 bg-white/[0.03] text-white/40',
}
const STATUS_LABEL: Record<AttendeeRow['status'], string> = {
  valid: 'Valid',
  checked_in: 'Checked in',
  void: 'Void',
  refunded: 'Refunded',
}

function csvCell(value: string): string {
  // Quote and escape per RFC 4180 so commas / quotes / newlines survive Excel.
  return `"${value.replace(/"/g, '""')}"`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TicketsManagerClient({
  event,
  tiers,
  attendees,
}: {
  event: TicketsEvent
  tiers: TierStat[]
  attendees: AttendeeRow[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const totals = useMemo(() => {
    const issued = tiers.reduce((s, t) => s + t.issued, 0)
    const capacity = tiers.reduce((s, t) => s + t.capacity, 0)
    const checkedIn = tiers.reduce((s, t) => s + t.checkedIn, 0)
    return { issued, capacity, checkedIn }
  }, [tiers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return attendees.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (!q) return true
      return (
        (a.name ?? '').toLowerCase().includes(q) ||
        (a.email ?? '').toLowerCase().includes(q) ||
        a.serial.toLowerCase().includes(q)
      )
    })
  }, [attendees, query, statusFilter])

  const statusCounts = useMemo(() => {
    const c = { all: attendees.length, valid: 0, checked_in: 0, void: 0 }
    for (const a of attendees) {
      if (a.status === 'valid') c.valid++
      else if (a.status === 'checked_in') c.checked_in++
      else if (a.status === 'void') c.void++
    }
    return c
  }, [attendees])

  async function voidTicket(ticketId: string) {
    if (busyId) return
    if (!confirm('Void this ticket? The holder will no longer be able to check in. This cannot be undone.')) {
      return
    }
    setBusyId(ticketId)
    setError(null)
    const { error: rpcError } = await supabase.rpc('void_ticket', { p_ticket_id: ticketId })
    setBusyId(null)
    if (rpcError) {
      setError(rpcError.message || 'Could not void that ticket.')
      return
    }
    router.refresh()
  }

  async function setTierStatus(tierId: string, next: 'active' | 'paused') {
    if (busyId) return
    setBusyId(tierId)
    setError(null)
    const { error: rpcError } = await supabase.rpc('organizer_set_tier_status', {
      p_tier_id: tierId,
      p_status: next,
    })
    setBusyId(null)
    if (rpcError) {
      setError(rpcError.message || 'Could not update that tier.')
      return
    }
    router.refresh()
  }

  function exportCsv() {
    const header = ['Name', 'Email', 'Tier', 'Serial', 'Status', 'Claimed', 'Checked in']
    const lines = [header.map(csvCell).join(',')]
    for (const a of filtered) {
      lines.push(
        [
          a.name ?? '',
          a.email ?? '',
          a.tierName,
          a.serial,
          STATUS_LABEL[a.status],
          formatDateTime(a.claimedAt),
          formatDateTime(a.checkedInAt),
        ]
          .map((v) => csvCell(String(v)))
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${event.slug}-attendees.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-4 pb-16 pt-24 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-flame-300">
                <Ticket className="h-3.5 w-3.5" />
                Tickets
              </div>
              <h1 className="mt-2 truncate text-2xl font-bold sm:text-3xl">{event.title}</h1>
              <p className="mt-1 text-sm text-white/50">
                {formatEventDateLabel(event.date)}
                {event.time ? ` · ${formatEventTimeLabel(event.time)}` : ''}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              {tiers.length > 0 && (
                <Link
                  href={`/organizer/events/${event.id}/door`}
                  className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] transition hover:bg-flame-400"
                >
                  <ScanLine className="h-4 w-4" />
                  Door mode
                </Link>
              )}
              {event.status === 'published' && (
                <Link
                  href={`/events/${event.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                >
                  View event
                </Link>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {tiers.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
              <Ticket className="mx-auto h-8 w-8 text-white/20" />
              <p className="mt-4 font-semibold text-white">No ticket tiers yet</p>
              <p className="mt-1 text-sm text-white/50">
                {event.is_civic
                  ? 'Civic events are always free to attend and never ticketed.'
                  : 'Add ticket tiers when you create or edit this event, then claims will show up here.'}
              </p>
              {!event.is_civic && (
                <Link
                  href={`/organizer/create?draft=${event.id}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-flame-400"
                >
                  Edit event
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Totals */}
              <section className="mt-8 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <Users className="h-4 w-4 text-flame-300" />
                  <p className="mt-3 text-2xl font-bold tabular-nums text-white">{totals.issued}</p>
                  <p className="mt-0.5 text-[11px] text-white/55">
                    Claimed{totals.capacity > 0 ? ` of ${totals.capacity}` : ''}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <p className="mt-3 text-2xl font-bold tabular-nums text-white">{totals.checkedIn}</p>
                  <p className="mt-0.5 text-[11px] text-white/55">Checked in</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <Ticket className="h-4 w-4 text-white/50" />
                  <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                    {totals.capacity > 0
                      ? `${Math.round((totals.issued / totals.capacity) * 100)}%`
                      : '—'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/55">Filled</p>
                </div>
              </section>

              {/* Tiers */}
              <section className="mt-6 space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Tiers</h2>
                {tiers.map((t) => {
                  const pct = t.capacity > 0 ? Math.min(100, Math.round((t.issued / t.capacity) * 100)) : 0
                  const paused = t.status === 'paused'
                  const busy = busyId === t.id
                  return (
                    <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white">{t.name}</p>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                              {t.priceCents === 0 ? 'Free' : `€${(t.priceCents / 100).toFixed(2)}`}
                            </span>
                            {paused && (
                              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                Paused
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-white/55 tabular-nums">
                            {t.issued} / {t.capacity} claimed · {t.checkedIn} in
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void setTierStatus(t.id, paused ? 'active' : 'paused')}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : paused ? (
                            <Play className="h-3.5 w-3.5" />
                          ) : (
                            <Pause className="h-3.5 w-3.5" />
                          )}
                          {paused ? 'Resume' : 'Pause'}
                        </button>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-flame-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <p className="text-[11px] text-white/35">
                  Paid tiers arrive with payments. For now every tier is free — pausing a tier stops new
                  claims without deleting anyone who already has a ticket.
                </p>
              </section>

              {/* Attendees */}
              <section className="mt-10">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Attendees
                  </h2>
                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={filtered.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name, email, serial"
                      className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none focus:ring-1 focus:ring-flame-500/30"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {([
                      ['all', 'All', statusCounts.all],
                      ['valid', 'Valid', statusCounts.valid],
                      ['checked_in', 'Checked in', statusCounts.checked_in],
                      ['void', 'Void', statusCounts.void],
                    ] as [StatusFilter, string, number][]).map(([key, label, n]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        className={[
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition',
                          statusFilter === key
                            ? 'bg-flame-500/20 text-flame-100 ring-1 ring-flame-500/40'
                            : 'bg-white/[0.03] text-white/55 ring-1 ring-white/10 hover:text-white/80',
                        ].join(' ')}
                      >
                        {label}
                        <span className={statusFilter === key ? 'text-flame-200/90' : 'text-white/40'}>{n}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
                    {attendees.length === 0
                      ? 'No tickets claimed yet. They will appear here the moment someone claims one.'
                      : 'No attendees match this view.'}
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.07]">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wide text-white/40">
                          <th className="px-4 py-3 font-semibold">Attendee</th>
                          <th className="px-4 py-3 font-semibold">Tier</th>
                          <th className="px-4 py-3 font-semibold">Serial</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Claimed</th>
                          <th className="px-4 py-3 font-semibold" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((a) => (
                          <tr key={a.ticketId} className="border-b border-white/[0.04] last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-medium text-white/90">{a.name || 'Guest'}</p>
                              {a.email && <p className="text-[11px] text-white/40">{a.email}</p>}
                            </td>
                            <td className="px-4 py-3 text-white/70">{a.tierName}</td>
                            <td className="px-4 py-3 font-mono text-[12px] text-white/60">{a.serial}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[a.status]}`}
                              >
                                {STATUS_LABEL[a.status]}
                                {a.status === 'checked_in' && a.checkedInAt
                                  ? ` · ${formatDateTime(a.checkedInAt)}`
                                  : ''}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[12px] text-white/50">{formatDateTime(a.claimedAt)}</td>
                            <td className="px-4 py-3 text-right">
                              {a.status === 'valid' && (
                                <button
                                  type="button"
                                  onClick={() => void voidTicket(a.ticketId)}
                                  disabled={busyId === a.ticketId}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[12px] text-white/50 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                                >
                                  {busyId === a.ticketId ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Ban className="h-3.5 w-3.5" />
                                  )}
                                  Void
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}
