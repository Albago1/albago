'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Flame, Pencil, Plus, RotateCcw, Search, Trash2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import AdminRepostModal from './AdminRepostModal'

type EventRow = {
  id: string
  slug: string
  title: string
  category: string
  date: string
  time: string | null
  status: string
  location_slug: string
  country: string
  region: string | null
  origin: string | null
  organizer_id: string | null
  is_civic: boolean | null
  event_type: string | null
  featured_movement_slug: string | null
  expected_attendees: number | null
  highlight: boolean | null
  created_at: string
  updated_at: string | null
}

type StatusFilter =
  | 'all'
  | 'published'
  | 'pending_review'
  | 'draft'
  | 'rejected'
  | 'cancelled'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'published', label: 'Published' },
  { key: 'pending_review', label: 'Pending' },
  { key: 'draft', label: 'Draft' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Archived' },
  { key: 'all', label: 'All' },
]

function statusBadgeClass(status: string) {
  if (status === 'published') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'pending_review') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (status === 'draft') return 'border-white/20 bg-white/[0.06] text-white/80'
  if (status === 'rejected') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (status === 'cancelled') return 'border-white/15 bg-white/[0.04] text-white/55'
  return 'border-white/15 bg-white/[0.04] text-white/70'
}

function formatStatus(status: string) {
  if (status === 'pending_review') return 'Pending review'
  if (status === 'cancelled') return 'Archived'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function EventsAdminClient() {
  const supabase = useMemo(() => createClient(), [])

  const [rows, setRows] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('published')
  const [civicOnly, setCivicOnly] = useState(false)
  const [search, setSearch] = useState('')

  const [repostSource, setRepostSource] = useState<{ id: string; title: string } | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    const { data, error } = await supabase
      .from('events')
      .select(
        'id, slug, title, category, date, time, status, location_slug, country, region, origin, organizer_id, is_civic, event_type, featured_movement_slug, expected_attendees, highlight, created_at, updated_at',
      )
      .order('date', { ascending: false })
      .limit(500)

    if (error) {
      setMessage(`Error loading events: ${error.message}`)
      setLoading(false)
      return
    }
    setRows((data as EventRow[] | null) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: rows.length,
      published: 0,
      pending_review: 0,
      draft: 0,
      rejected: 0,
      cancelled: 0,
    }
    for (const r of rows) {
      if (r.status in base) base[r.status as StatusFilter] += 1
    }
    return base
  }, [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (civicOnly && !r.is_civic) return false
      if (q) {
        const blob = `${r.title} ${r.location_slug} ${r.country} ${r.featured_movement_slug ?? ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [rows, statusFilter, civicOnly, search])

  const patchStatus = async (row: EventRow, nextStatus: string, verbed: string) => {
    setActionId(row.id)
    setMessage(null)
    const { error } = await supabase.rpc('admin_update_event', {
      event_id: row.id,
      patch: { status: nextStatus },
    })
    setActionId(null)
    if (error) {
      console.error('admin_update_event error:', error)
      if (error.code === '42501') {
        setMessage(
          `${verbed} failed: not allowed. Has the Phase 11 RPC been applied? See docs/seeds/phase-11-admin-event-update.sql.`,
        )
        return
      }
      setMessage(`${verbed} failed: ${error.message}`)
      return
    }
    await fetchRows()
  }

  const unpublishRow = (row: EventRow) => patchStatus(row, 'draft', 'Unpublish')
  const archiveRow = (row: EventRow) => patchStatus(row, 'cancelled', 'Archive')
  const restoreRow = (row: EventRow) => patchStatus(row, 'draft', 'Restore')
  const publishRow = (row: EventRow) => patchStatus(row, 'published', 'Publish')

  const deleteRow = async (row: EventRow) => {
    if (
      !window.confirm(
        `Permanently delete "${row.title}"? This cannot be undone.`,
      )
    ) {
      return
    }
    setActionId(row.id)
    setMessage(null)
    const { error } = await supabase.from('events').delete().eq('id', row.id)
    setActionId(null)
    if (error) {
      console.error('events delete error:', error)
      if (error.code === '42501') {
        setMessage(
          'Delete not allowed. Admin DELETE policy may be missing — check events_admin_write policy.',
        )
        return
      }
      setMessage(`Delete failed: ${error.message}`)
      return
    }
    await fetchRows()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to admin
          </Link>
          <h1 className="text-3xl font-bold">Events &amp; protests</h1>
          <p className="mt-2 text-sm text-white/55">
            Edit, unpublish, or archive any published or draft event — including civic
            gatherings. Approving submissions still happens in the Submissions queue.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/events/new"
          className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
        >
          <Plus className="h-4 w-4" />
          New event
        </Link>
        <Link
          href="/admin/volunteers"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Users className="h-4 w-4" />
          Volunteer signups
        </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={[
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
              statusFilter === tab.key
                ? 'border-white/20 bg-white/[0.08] text-white'
                : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.04] hover:text-white/80',
            ].join(' ')}
          >
            {tab.label}
            <span
              className={[
                'rounded-full px-2 py-0.5 text-xs',
                statusFilter === tab.key ? 'bg-white/15' : 'bg-white/[0.06]',
              ].join(' ')}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setCivicOnly((v) => !v)}
          className={[
            'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
            civicOnly
              ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
              : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.04] hover:text-white/80',
          ].join(' ')}
        >
          <Flame className="h-3.5 w-3.5" />
          Civic only
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <label htmlFor="admin-events-search" className="sr-only">
            Search events
          </label>
          <input
            id="admin-events-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, city, country, movement..."
            className="h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-white/20"
          />
        </div>
        <span className="text-xs text-white/45">
          {visible.length} of {rows.length}
        </span>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">
          {message}
        </div>
      )}

      {loading && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          Loading events...
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          No events match this filter.
        </div>
      )}

      <div className="mt-5 space-y-3">
        {visible.map((row) => {
          const isWorking = actionId === row.id
          const isPublished = row.status === 'published'
          const isDraft = row.status === 'draft'
          const isPending = row.status === 'pending_review'
          const isArchived = row.status === 'cancelled'

          return (
            <article
              key={row.id}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-white">{row.title}</h3>
                  <p className="mt-1 text-xs text-white/55">
                    {row.date}
                    {row.time && ` · ${row.time}`}
                    {' · '}
                    {row.location_slug}
                    {' · '}
                    {row.country}
                    {row.is_civic && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-2 py-0.5 text-xs text-flame-300">
                        <Flame className="h-3 w-3" />
                        civic
                      </span>
                    )}
                    {row.highlight && (
                      <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-2 py-0.5 text-xs text-amber-300">
                        featured
                      </span>
                    )}
                  </p>
                  {row.featured_movement_slug && (
                    <p className="mt-1 text-xs text-white/40">
                      movement: {row.featured_movement_slug}
                    </p>
                  )}
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                >
                  {formatStatus(row.status)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/events/${row.id}/edit`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Link>

                <Link
                  href={`/events/${row.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Preview
                </Link>

                {(isDraft || isPending) && (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => publishRow(row)}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                  >
                    {isWorking ? 'Publishing...' : 'Publish'}
                  </button>
                )}

                {isPublished && (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => unpublishRow(row)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.08]"
                  >
                    {isWorking ? 'Unpublishing...' : 'Unpublish'}
                  </button>
                )}

                {!isArchived && (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => archiveRow(row)}
                    className="rounded-full border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15"
                  >
                    Archive
                  </button>
                )}

                {isArchived && (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => restoreRow(row)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.08]"
                  >
                    Restore to draft
                  </button>
                )}

                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => setRepostSource({ id: row.id, title: row.title })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-3 py-2 text-xs font-semibold text-flame-200 transition hover:bg-flame-500/15"
                  title="Create a new draft event from this one with a new date"
                >
                  <RotateCcw className="h-3 w-3" />
                  Repost
                </button>

                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => deleteRow(row)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/[0.04] px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15 disabled:opacity-40"
                  title="Permanently delete this event"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {repostSource && (
        <AdminRepostModal
          sourceEventId={repostSource.id}
          sourceTitle={repostSource.title}
          onClose={() => setRepostSource(null)}
          onCreated={() => {
            setRepostSource(null)
            setMessage('Repost created as a new draft event.')
            void fetchRows()
          }}
        />
      )}
    </div>
  )
}
