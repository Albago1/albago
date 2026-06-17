'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarRange,
  Check,
  Flame,
  Pencil,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import UserStatsCard from './UserStatsCard'
import AdminRepostModal from './events/AdminRepostModal'

type SubmissionRow = {
  id: string
  title: string
  venue_name: string
  place_id: string | null
  category: string
  description: string
  date: string
  time: string
  end_time: string | null
  timezone: string | null
  price: string | null
  contact_email: string
  status: string
  admin_note: string | null
  created_at: string
  country: string
  region: string | null
  location_slug: string
  event_type: string | null
  is_civic: boolean | null
  featured_movement_slug: string | null
  organizer_contact: string | null
  organizer_name: string | null
  organizer_phone: string | null
  organizer_website: string | null
  organizer_socials: Record<string, string> | null
  telegram_link: string | null
  whatsapp_link: string | null
  safety_notes: string | null
  expected_attendees: number | null
  lat: number | null
  lng: number | null
  address: string | null
  is_online: boolean | null
  online_url: string | null
  tags: string[] | null
  language: string | null
  banner_url: string | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
}

type EventRow = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string
  date: string
  time: string | null
  price: string | null
  highlight: boolean | null
  status: string
  location_slug: string
  country: string
  region: string | null
  origin: string | null
  organizer_id: string | null
  admin_note: string | null
  is_civic: boolean | null
  event_type: string | null
  featured_movement_slug: string | null
  expected_attendees: number | null
  telegram_link: string | null
  whatsapp_link: string | null
  safety_notes: string | null
  created_at: string
}

type UnifiedRow = {
  key: string
  source: 'submission' | 'event'
  origin: 'community' | 'organizer' | 'admin' | 'imported'
  rowId: string
  title: string
  description: string
  category: string
  status: string
  unifiedStatus: 'pending' | 'published' | 'draft' | 'rejected' | 'archived' | 'completed' | 'approved'
  date: string
  time: string | null
  price: string | null
  locationSlug: string
  country: string
  isCivic: boolean
  eventType: string | null
  featuredMovementSlug: string | null
  expectedAttendees: number | null
  telegramLink: string | null
  whatsappLink: string | null
  safetyNotes: string | null
  adminNote: string | null
  createdAt: string
  // Source-specific
  slug?: string
  venueName?: string
  contactEmail?: string
  lat?: number | null
  lng?: number | null
  organizerId?: string | null
}

type SourceFilter = 'all' | 'submissions' | 'events' | 'organizer'
type StatusFilter = 'all' | 'pending' | 'published' | 'draft' | 'rejected' | 'archived'

const SOURCE_TABS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submissions', label: 'Submissions' },
  { key: 'events', label: 'Events' },
  { key: 'organizer', label: 'Organizer events' },
]

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'archived', label: 'Archived' },
]

function mapSubmission(s: SubmissionRow): UnifiedRow {
  let unifiedStatus: UnifiedRow['unifiedStatus'] = 'pending'
  if (s.status === 'pending') unifiedStatus = 'pending'
  else if (s.status === 'approved') unifiedStatus = 'approved'
  else if (s.status === 'rejected') unifiedStatus = 'rejected'

  return {
    key: `s:${s.id}`,
    source: 'submission',
    origin: 'community',
    rowId: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    status: s.status,
    unifiedStatus,
    date: s.date,
    time: s.time,
    price: s.price,
    locationSlug: s.location_slug,
    country: s.country,
    isCivic: !!s.is_civic || s.category === 'civic',
    eventType: s.event_type,
    featuredMovementSlug: s.featured_movement_slug,
    expectedAttendees: s.expected_attendees,
    telegramLink: s.telegram_link,
    whatsappLink: s.whatsapp_link,
    safetyNotes: s.safety_notes,
    adminNote: s.admin_note,
    createdAt: s.created_at,
    venueName: s.venue_name,
    contactEmail: s.contact_email,
    lat: s.lat,
    lng: s.lng,
  }
}

function mapEvent(e: EventRow): UnifiedRow {
  let unifiedStatus: UnifiedRow['unifiedStatus'] = 'published'
  if (e.status === 'published') unifiedStatus = 'published'
  else if (e.status === 'draft') unifiedStatus = 'draft'
  else if (e.status === 'pending_review') unifiedStatus = 'pending'
  else if (e.status === 'rejected') unifiedStatus = 'rejected'
  else if (e.status === 'cancelled') unifiedStatus = 'archived'
  else if (e.status === 'completed') unifiedStatus = 'completed'

  let origin: UnifiedRow['origin'] = 'admin'
  if (e.organizer_id) origin = 'organizer'
  else if (e.origin === 'community_submission') origin = 'community'
  else if (e.origin === 'imported') origin = 'imported'

  return {
    key: `e:${e.id}`,
    source: 'event',
    origin,
    rowId: e.id,
    title: e.title,
    description: e.description ?? '',
    category: e.category,
    status: e.status,
    unifiedStatus,
    date: e.date,
    time: e.time,
    price: e.price,
    locationSlug: e.location_slug,
    country: e.country,
    isCivic: !!e.is_civic,
    eventType: e.event_type,
    featuredMovementSlug: e.featured_movement_slug,
    expectedAttendees: e.expected_attendees,
    telegramLink: e.telegram_link,
    whatsappLink: e.whatsapp_link,
    safetyNotes: e.safety_notes,
    adminNote: e.admin_note,
    createdAt: e.created_at,
    slug: e.slug,
    organizerId: e.organizer_id,
  }
}

function statusBadgeClass(unified: UnifiedRow['unifiedStatus']) {
  if (unified === 'published')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (unified === 'pending')
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (unified === 'approved')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (unified === 'draft')
    return 'border-white/20 bg-white/[0.06] text-white/80'
  if (unified === 'rejected')
    return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (unified === 'archived')
    return 'border-white/15 bg-white/[0.04] text-white/55'
  return 'border-white/15 bg-white/[0.04] text-white/70'
}

function statusLabel(row: UnifiedRow) {
  if (row.unifiedStatus === 'pending')
    return row.source === 'submission' ? 'Pending review' : 'Awaiting publish'
  if (row.unifiedStatus === 'approved') return 'Approved'
  if (row.unifiedStatus === 'published') return 'Published'
  if (row.unifiedStatus === 'draft') return 'Draft'
  if (row.unifiedStatus === 'rejected') return 'Rejected'
  if (row.unifiedStatus === 'archived') return 'Archived'
  if (row.unifiedStatus === 'completed') return 'Completed'
  return row.status
}

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export default function AdminClient() {
  const supabase = useMemo(() => createClient(), [])

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [civicOnly, setCivicOnly] = useState(false)
  const [search, setSearch] = useState('')

  const [repostSource, setRepostSource] = useState<{ id: string; title: string } | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    const [subRes, evRes] = await Promise.all([
      supabase
        .from('event_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('events')
        .select(
          'id, slug, title, description, category, date, time, price, highlight, status, location_slug, country, region, origin, organizer_id, admin_note, is_civic, event_type, featured_movement_slug, expected_attendees, telegram_link, whatsapp_link, safety_notes, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    if (subRes.error) setMessage(`Submissions error: ${subRes.error.message}`)
    if (evRes.error) setMessage((prev) => (prev ? `${prev} · ` : '') + `Events error: ${evRes.error!.message}`)

    setSubmissions((subRes.data as SubmissionRow[] | null) ?? [])
    setEvents((evRes.data as EventRow[] | null) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const unifiedRows: UnifiedRow[] = useMemo(() => {
    const sub = submissions.map(mapSubmission)
    const ev = events.map(mapEvent)
    return [...sub, ...ev].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [submissions, events])

  const counts = useMemo(() => {
    const bySource: Record<SourceFilter, number> = {
      all: unifiedRows.length,
      submissions: 0,
      events: 0,
      organizer: 0,
    }
    const byStatus: Record<StatusFilter, number> = {
      all: unifiedRows.length,
      pending: 0,
      published: 0,
      draft: 0,
      rejected: 0,
      archived: 0,
    }
    for (const r of unifiedRows) {
      if (r.source === 'submission') bySource.submissions += 1
      else {
        bySource.events += 1
        if (r.organizerId) bySource.organizer += 1
      }
      if (r.unifiedStatus in byStatus) byStatus[r.unifiedStatus as StatusFilter] += 1
    }
    return { bySource, byStatus }
  }, [unifiedRows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return unifiedRows.filter((r) => {
      if (sourceFilter === 'submissions' && r.source !== 'submission') return false
      if (sourceFilter === 'events' && r.source !== 'event') return false
      if (sourceFilter === 'organizer' && !(r.source === 'event' && r.organizerId)) return false
      if (statusFilter !== 'all' && r.unifiedStatus !== statusFilter) return false
      if (civicOnly && !r.isCivic) return false
      if (q) {
        const blob = `${r.title} ${r.locationSlug} ${r.country} ${r.featuredMovementSlug ?? ''} ${r.category}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [unifiedRows, sourceFilter, statusFilter, civicOnly, search])

  // -- Submission actions -----------------------------------------------------

  const approveSubmission = async (row: UnifiedRow) => {
    const s = submissions.find((x) => x.id === row.rowId)
    if (!s) return

    setActionId(row.key)
    setMessage(null)

    const slug = `${createSlug(s.title)}-${s.id.slice(0, 8)}`
    const isCivic = s.is_civic === true || s.category === 'civic'

    // Auto-seed cities row if this city isn't registered yet. Best-effort:
    // errors here are non-fatal — we still publish the event. Only runs when
    // we have coordinates (civic flow always has them; non-civic may not).
    if (s.lat != null && s.lng != null && s.location_slug) {
      const { error: cityError } = await supabase.rpc('upsert_city_from_event', {
        p_slug: s.location_slug,
        p_name: s.location_slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        p_country: s.country,
        p_lat: s.lat,
        p_lng: s.lng,
      })
      if (cityError) {
        console.warn('upsert_city_from_event:', cityError.message)
      }
    }

    const { error: eventError } = await supabase.from('events').insert({
      title: s.title,
      slug,
      place_id: s.place_id ?? null,
      category: s.category,
      description: s.description,
      date: s.date,
      time: s.time,
      end_time: s.end_time ?? null,
      timezone: s.timezone ?? null,
      price: s.price ?? null,
      highlight: false,
      status: 'published',
      country: s.country,
      region: s.region,
      location_slug: s.location_slug,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      address: s.address ?? null,
      is_online: s.is_online ?? false,
      online_url: s.online_url ?? null,
      tags: s.tags ?? [],
      language: s.language ?? 'en',
      banner_url: s.banner_url ?? null,
      organizer_name: s.organizer_name ?? null,
      organizer_phone: s.organizer_phone ?? null,
      organizer_website: s.organizer_website ?? null,
      organizer_socials: s.organizer_socials ?? null,
      recurrence: s.recurrence ?? 'none',
      recurrence_until: s.recurrence_until ?? null,
      recurrence_days_of_week: s.recurrence_days_of_week ?? [],
      recurrence_exceptions: s.recurrence_exceptions ?? [],
      ...(isCivic && {
        event_type: s.event_type ?? 'protest',
        is_civic: true,
        featured_movement_slug: s.featured_movement_slug ?? null,
        organizer_contact: s.organizer_contact ?? s.contact_email,
        telegram_link: s.telegram_link ?? null,
        whatsapp_link: s.whatsapp_link ?? null,
        safety_notes: s.safety_notes ?? null,
        expected_attendees: s.expected_attendees ?? null,
      }),
    })

    if (eventError) {
      setActionId(null)
      setMessage(`Publish error: ${eventError.message}`)
      return
    }

    const { error: subError } = await supabase
      .from('event_submissions')
      .update({ status: 'approved' })
      .eq('id', s.id)

    setActionId(null)
    if (subError) {
      setMessage(`Approve error: ${subError.message}`)
      return
    }
    await fetchAll()
  }

  const rejectSubmission = async (row: UnifiedRow) => {
    setActionId(row.key)
    setMessage(null)

    const { error } = await supabase
      .from('event_submissions')
      .update({
        status: 'rejected',
        ...(rejectNote.trim() ? { admin_note: rejectNote.trim() } : {}),
      })
      .eq('id', row.rowId)

    setActionId(null)
    setRejectingId(null)
    setRejectNote('')
    if (error) {
      setMessage(`Reject error: ${error.message}`)
      return
    }
    await fetchAll()
  }

  // -- Event actions ----------------------------------------------------------

  const patchEventStatus = async (row: UnifiedRow, nextStatus: string, label: string) => {
    setActionId(row.key)
    setMessage(null)

    // Organizer pending_review → use admin_publish_event (stamps published_at)
    if (row.organizerId && row.status === 'pending_review' && nextStatus === 'published') {
      const { error } = await supabase.rpc('admin_publish_event', { event_id: row.rowId })
      setActionId(null)
      if (error) {
        console.error('admin_publish_event error:', error)
        setMessage(`${label} failed: ${error.message}`)
        return
      }
      await fetchAll()
      return
    }

    const { error } = await supabase.rpc('admin_update_event', {
      event_id: row.rowId,
      patch: { status: nextStatus },
    })
    setActionId(null)
    if (error) {
      console.error('admin_update_event error:', error)
      if (error.code === '42501') {
        setMessage(
          `${label} failed: not allowed. Has docs/seeds/phase-11-admin-event-update.sql been applied?`,
        )
        return
      }
      setMessage(`${label} failed: ${error.message}`)
      return
    }
    await fetchAll()
  }

  const rejectEvent = async (row: UnifiedRow) => {
    setActionId(row.key)
    setMessage(null)

    if (row.organizerId) {
      const { error } = await supabase.rpc('admin_reject_event', {
        event_id: row.rowId,
        note: rejectNote.trim() || null,
      })
      setActionId(null)
      setRejectingId(null)
      setRejectNote('')
      if (error) {
        setMessage(`Reject failed: ${error.message}`)
        return
      }
      await fetchAll()
      return
    }

    const { error } = await supabase.rpc('admin_update_event', {
      event_id: row.rowId,
      patch: {
        status: 'rejected',
        ...(rejectNote.trim() ? { admin_note: rejectNote.trim() } : {}),
      },
    })
    setActionId(null)
    setRejectingId(null)
    setRejectNote('')
    if (error) {
      setMessage(`Reject failed: ${error.message}`)
      return
    }
    await fetchAll()
  }

  // -- Delete actions ---------------------------------------------------------

  const deleteSubmission = async (row: UnifiedRow) => {
    if (
      !window.confirm(
        `Permanently delete submission "${row.title}"? This cannot be undone.`,
      )
    ) {
      return
    }
    setActionId(row.key)
    setMessage(null)
    const { error } = await supabase
      .from('event_submissions')
      .delete()
      .eq('id', row.rowId)
    setActionId(null)
    if (error) {
      console.error('event_submissions delete error:', error)
      if (error.code === '42501') {
        setMessage(
          'Delete not allowed. Apply docs/seeds/phase-13.3-admin-delete-policies.sql in Supabase.',
        )
        return
      }
      setMessage(`Delete failed: ${error.message}`)
      return
    }
    await fetchAll()
  }

  const deleteEvent = async (row: UnifiedRow) => {
    if (
      !window.confirm(
        `Permanently delete event "${row.title}"? This cannot be undone.`,
      )
    ) {
      return
    }
    setActionId(row.key)
    setMessage(null)
    const { error } = await supabase.from('events').delete().eq('id', row.rowId)
    setActionId(null)
    if (error) {
      console.error('events delete error:', error)
      if (error.code === '42501') {
        setMessage(
          'Delete not allowed. Check the events_admin_write RLS policy.',
        )
        return
      }
      setMessage(`Delete failed: ${error.message}`)
      return
    }
    await fetchAll()
  }

  // -- Render -----------------------------------------------------------------

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="mt-2 text-sm text-white/55">
            Unified view of community submissions, organizer events, and the live
            events table. Approve, publish, unpublish, archive — all in one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Users className="h-4 w-4" />
            Users
          </Link>
          <Link
            href="/admin/volunteers"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Users className="h-4 w-4" />
            Volunteer signups
          </Link>
          <Link
            href="/admin/organizers"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            Organizers
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <UserStatsCard />
      </div>

      <section className="mt-6 space-y-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Source
          </p>
          <div className="flex flex-wrap gap-2">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSourceFilter(tab.key)}
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                  sourceFilter === tab.key
                    ? 'border-white/20 bg-white/[0.08] text-white'
                    : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.04] hover:text-white/80',
                ].join(' ')}
              >
                {tab.label}
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-xs',
                    sourceFilter === tab.key ? 'bg-white/15' : 'bg-white/[0.06]',
                  ].join(' ')}
                >
                  {counts.bySource[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
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
                  {counts.byStatus[tab.key]}
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
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <label htmlFor="admin-search" className="sr-only">
              Search
            </label>
            <input
              id="admin-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, city, country, movement, category..."
              className="h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-white/20"
            />
          </div>
          <span className="text-xs text-white/45">
            {visible.length} of {unifiedRows.length}
          </span>
        </div>
      </section>

      {message && (
        <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">
          {message}
        </div>
      )}

      {loading && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          Loading...
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          Nothing matches this filter.
        </div>
      )}

      <div className="mt-5 space-y-3">
        {visible.map((row) => (
          <RowCard
            key={row.key}
            row={row}
            actionId={actionId}
            rejectingId={rejectingId}
            rejectNote={rejectNote}
            setRejectingId={setRejectingId}
            setRejectNote={setRejectNote}
            onApproveSubmission={approveSubmission}
            onRejectSubmission={rejectSubmission}
            onPatchEventStatus={patchEventStatus}
            onRejectEvent={rejectEvent}
            onDeleteSubmission={deleteSubmission}
            onDeleteEvent={deleteEvent}
            onRepostEvent={(r) => setRepostSource({ id: r.rowId, title: r.title })}
          />
        ))}
      </div>

      {repostSource && (
        <AdminRepostModal
          sourceEventId={repostSource.id}
          sourceTitle={repostSource.title}
          onClose={() => setRepostSource(null)}
          onCreated={() => {
            setRepostSource(null)
            setMessage('Repost created as a new draft event.')
            void fetchAll()
          }}
        />
      )}
    </div>
  )
}

function RowCard(props: {
  row: UnifiedRow
  actionId: string | null
  rejectingId: string | null
  rejectNote: string
  setRejectingId: (id: string | null) => void
  setRejectNote: (note: string) => void
  onApproveSubmission: (row: UnifiedRow) => void
  onRejectSubmission: (row: UnifiedRow) => void
  onPatchEventStatus: (row: UnifiedRow, nextStatus: string, label: string) => void
  onRejectEvent: (row: UnifiedRow) => void
  onDeleteSubmission: (row: UnifiedRow) => void
  onDeleteEvent: (row: UnifiedRow) => void
  onRepostEvent: (row: UnifiedRow) => void
}) {
  const {
    row,
    actionId,
    rejectingId,
    rejectNote,
    setRejectingId,
    setRejectNote,
    onApproveSubmission,
    onRejectSubmission,
    onPatchEventStatus,
    onRejectEvent,
    onDeleteSubmission,
    onDeleteEvent,
    onRepostEvent,
  } = props

  const isWorking = actionId === row.key
  const isRejectingThis = rejectingId === row.key
  const sourceBadge =
    row.source === 'submission'
      ? 'submission'
      : row.organizerId
        ? 'organizer event'
        : 'event'

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/55">
              {sourceBadge}
            </span>
            {row.isCivic && (
              <span className="inline-flex items-center gap-1 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-2 py-0.5 text-xs text-flame-300">
                <Flame className="h-3 w-3" />
                civic
              </span>
            )}
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold text-white">{row.title}</h2>
          <p className="mt-1 text-xs text-white/55">
            {row.date}
            {row.time && ` · ${row.time}`}
            {' · '}
            {row.locationSlug}
            {' · '}
            {row.country}
            {' · '}
            {row.category}
            {row.featuredMovementSlug && (
              <>
                {' · movement: '}
                <code className="rounded bg-white/10 px-1 text-[10px]">
                  {row.featuredMovementSlug}
                </code>
              </>
            )}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(row.unifiedStatus)}`}
        >
          {statusLabel(row)}
        </span>
      </div>

      {row.description && (
        <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-white/70">
          {row.description}
        </p>
      )}

      {row.isCivic &&
        (row.expectedAttendees != null ||
          row.telegramLink ||
          row.whatsappLink ||
          row.safetyNotes) && (
          <div className="mt-3 rounded-2xl border border-flame-500/20 bg-flame-500/[0.04] p-3 space-y-1 text-xs text-white/65">
            {row.expectedAttendees != null && (
              <p>Expected attendees: {row.expectedAttendees.toLocaleString()}</p>
            )}
            {row.telegramLink && (
              <p>
                Telegram:{' '}
                <a
                  href={row.telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-flame-300 hover:underline"
                >
                  {row.telegramLink}
                </a>
              </p>
            )}
            {row.whatsappLink && (
              <p>
                WhatsApp:{' '}
                <a
                  href={row.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-flame-300 hover:underline"
                >
                  {row.whatsappLink}
                </a>
              </p>
            )}
            {row.safetyNotes && <p className="leading-5">Safety: {row.safetyNotes}</p>}
          </div>
        )}

      {row.adminNote && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">
          <span className="font-semibold text-white/80">Admin note: </span>
          {row.adminNote}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Source-specific primary actions */}
        {row.source === 'submission' && row.unifiedStatus === 'pending' && !isRejectingThis && (
          <>
            <button
              type="button"
              disabled={isWorking}
              onClick={() => onApproveSubmission(row)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
              {isWorking ? 'Approving...' : 'Approve & publish'}
            </button>
            <button
              type="button"
              disabled={isWorking}
              onClick={() => setRejectingId(row.key)}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </button>
          </>
        )}

        {row.source === 'event' && (
          <>
            <Link
              href={`/admin/events/${row.rowId}/edit`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
            {row.slug && (
              <Link
                href={`/events/${row.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                Preview
              </Link>
            )}

            {(row.unifiedStatus === 'draft' || row.unifiedStatus === 'pending') &&
              !isRejectingThis && (
                <>
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => onPatchEventStatus(row, 'published', 'Publish')}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {isWorking ? 'Publishing...' : 'Publish'}
                  </button>
                  {row.organizerId && row.unifiedStatus === 'pending' && (
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => setRejectingId(row.key)}
                      className="rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  )}
                </>
              )}

            {row.unifiedStatus === 'published' && (
              <button
                type="button"
                disabled={isWorking}
                onClick={() => onPatchEventStatus(row, 'draft', 'Unpublish')}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                Unpublish
              </button>
            )}

            {row.unifiedStatus !== 'archived' && (
              <button
                type="button"
                disabled={isWorking}
                onClick={() => onPatchEventStatus(row, 'cancelled', 'Archive')}
                className="rounded-full border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15 disabled:opacity-40"
              >
                Archive
              </button>
            )}

            {row.unifiedStatus === 'archived' && (
              <button
                type="button"
                disabled={isWorking}
                onClick={() => onPatchEventStatus(row, 'draft', 'Restore')}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                Restore to draft
              </button>
            )}

            <button
              type="button"
              disabled={isWorking}
              onClick={() => onRepostEvent(row)}
              className="inline-flex items-center gap-1.5 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-3 py-2 text-xs font-semibold text-flame-200 transition hover:bg-flame-500/15 disabled:opacity-40"
              title="Create a new draft event from this one with a new date"
            >
              <RotateCcw className="h-3 w-3" />
              Repost
            </button>
          </>
        )}

        {row.source === 'submission' && row.unifiedStatus !== 'pending' && (
          <span className="text-xs text-white/45">
            {row.unifiedStatus === 'approved'
              ? 'Already published as an event.'
              : 'Awaiting resubmission.'}
          </span>
        )}

        <button
          type="button"
          disabled={isWorking}
          onClick={() =>
            row.source === 'submission'
              ? onDeleteSubmission(row)
              : onDeleteEvent(row)
          }
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/[0.04] px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15 disabled:opacity-40"
          title="Permanently delete"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>

      {isRejectingThis && (
        <div className="mt-4 space-y-3">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Optional note for the submitter / organizer..."
            rows={2}
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isWorking}
              onClick={() =>
                row.source === 'submission' ? onRejectSubmission(row) : onRejectEvent(row)
              }
              className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              {isWorking ? 'Rejecting...' : 'Confirm reject'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectingId(null)
                setRejectNote('')
              }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
