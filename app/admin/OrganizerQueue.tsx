'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'

type OrganizerEventRow = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string
  date: string
  time: string | null
  price: string | null
  location_slug: string
  country: string
  region: string | null
  status: string
  origin: string
  organizer_id: string | null
  banner_url: string | null
  admin_note: string | null
  created_at: string
  is_civic: boolean | null
  expected_attendees: number | null
}

type StatusFilter = 'pending_review' | 'rejected' | 'all'

function statusBadgeClass(status: string) {
  if (status === 'pending_review') return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
  if (status === 'rejected') return 'border-red-500/20 bg-red-500/10 text-red-300'
  if (status === 'published') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
  if (status === 'draft') return 'border-white/20 bg-white/10 text-white/80'
  return 'border-white/15 bg-white/5 text-white/70'
}

function formatStatus(status: string) {
  if (status === 'pending_review') return 'Pending review'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function OrganizerQueue() {
  const supabase = useMemo(() => createClient(), [])

  const [rows, setRows] = useState<OrganizerEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('pending_review')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  // No synchronous setState before the first await — the mount effect calls
  // this directly (loading starts true); refresh() handles spinner resets.
  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select(
        'id, slug, title, description, category, date, time, price, location_slug, country, region, status, origin, organizer_id, banner_url, admin_note, created_at, is_civic, expected_attendees'
      )
      .in('status', ['pending_review', 'rejected', 'draft', 'published'])
      .not('organizer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      setMessage(`Error loading organizer events: ${error.message}`)
      setLoading(false)
      return
    }
    setRows((data as OrganizerEventRow[] | null) ?? [])
    setLoading(false)
  }, [supabase])

  const refresh = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    await fetchRows()
  }, [fetchRows])

  useEffect(() => {
    // Mount fetch: fetchRows only calls setState after its await, but the
    // rule can't trace through the function call. Same pattern as UsersClient.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRows()
  }, [fetchRows])

  const counts = useMemo(
    () => ({
      pending_review: rows.filter((r) => r.status === 'pending_review').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
      all: rows.length,
    }),
    [rows]
  )

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter]
  )

  const publishRow = async (row: OrganizerEventRow) => {
    setActionId(row.id)
    setMessage(null)
    const { error } = await supabase.rpc('admin_publish_event', {
      event_id: row.id,
    })
    setActionId(null)
    if (error) {
      console.error('admin_publish_event error:', error)
      if (error.code === '42501' || error.message.includes('permission denied')) {
        setMessage(
          'Publish failed: RPC may be missing GRANT EXECUTE. See docs/next-session.md.'
        )
        return
      }
      setMessage(`Publish failed: ${error.message}`)
      return
    }
    await refresh()
  }

  const rejectRow = async (row: OrganizerEventRow) => {
    setActionId(row.id)
    setMessage(null)
    const { error } = await supabase.rpc('admin_reject_event', {
      event_id: row.id,
      note: rejectNote.trim() || null,
    })
    setActionId(null)
    setRejectingId(null)
    setRejectNote('')
    if (error) {
      console.error('admin_reject_event error:', error)
      setMessage(`Reject failed: ${error.message}`)
      return
    }
    await refresh()
  }

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'pending_review', label: 'Pending review' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All organizer events' },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">Organizer queue</h2>
          <p className="mt-1 text-sm text-white/55">
            Events submitted by verified organizers through their dashboard. Approve or reject via the
            Phase 7B RPCs.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={[
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
              filter === tab.key
                ? 'border-white/20 bg-white/[0.08] text-white'
                : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.04] hover:text-white/80',
            ].join(' ')}
          >
            {tab.label}
            <span
              className={[
                'rounded-full px-2 py-0.5 text-xs',
                filter === tab.key ? 'bg-white/15' : 'bg-white/[0.06]',
              ].join(' ')}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">
          {message}
        </div>
      )}

      {loading && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          Loading organizer events...
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          No {filter === 'all' ? '' : formatStatus(filter).toLowerCase()} organizer events.
        </div>
      )}

      <div className="mt-5 space-y-4">
        {visible.map((row) => {
          const isPending = row.status === 'pending_review'
          const isRejected = row.status === 'rejected'
          const isWorking = actionId === row.id
          const isRejectingThis = rejectingId === row.id

          return (
            <article
              key={row.id}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">{row.title}</h3>
                  <p className="mt-1 text-sm text-white/55">
                    {row.category}
                    {' · '}
                    {row.location_slug}
                    {row.is_civic && (
                      <span className="ml-2 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-2 py-0.5 text-xs text-flame-300">
                        civic
                      </span>
                    )}
                    <span className="ml-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-white/55">
                      {row.origin}
                    </span>
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                >
                  {formatStatus(row.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-white/60 sm:grid-cols-2">
                <p>Date: {row.date}</p>
                {row.time && <p>Time: {row.time}</p>}
                {row.price && <p>Price: {row.price}</p>}
                <p>Submitted: {new Date(row.created_at).toLocaleString()}</p>
                {row.expected_attendees != null && (
                  <p>Expected attendees: {row.expected_attendees.toLocaleString()}</p>
                )}
                <p className="font-mono text-xs text-white/40">slug: {row.slug}</p>
              </div>

              {row.description && (
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/70">
                  {row.description}
                </p>
              )}

              {row.admin_note && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/65">
                  <span className="font-semibold text-white/80">Previous admin note: </span>
                  {row.admin_note}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/events/${row.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Preview
                </Link>

                {isPending && !isRejectingThis && (
                  <>
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => publishRow(row)}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {isWorking ? 'Publishing...' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => setRejectingId(row.id)}
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </>
                )}

                {isRejected && (
                  <span className="text-xs text-white/45">
                    Awaiting organizer revision and resubmit.
                  </span>
                )}
              </div>

              {isRejectingThis && (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Optional note for the organizer..."
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => rejectRow(row)}
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
                    >
                      {isWorking ? 'Rejecting...' : 'Confirm reject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null)
                        setRejectNote('')
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
