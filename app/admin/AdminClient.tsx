'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  CheckSquare,
  ChevronDown,
  Eye,
  Flame,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import UserStatsCard from './UserStatsCard'
import EventPagePreview, { type EventPreviewData } from '@/components/events/EventPagePreview'
import { getLocationBySlug } from '@/lib/locations'
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
  address_hint: string | null
  is_online: boolean | null
  online_url: string | null
  tags: string[] | null
  language: string | null
  banner_url: string | null
  gallery_urls: string[] | null
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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return `${Math.floor(d / 30)}mo`
}

// Which queue operations exist for a row — single source of truth shared by
// the row buttons, the bulk bar, and the keyboard shortcuts.
function canApprove(row: UnifiedRow): boolean {
  if (row.source === 'submission') return row.unifiedStatus === 'pending'
  return row.unifiedStatus === 'draft' || row.unifiedStatus === 'pending'
}

function canReject(row: UnifiedRow): boolean {
  if (row.source === 'submission') return row.unifiedStatus === 'pending'
  return row.unifiedStatus === 'pending' && !!row.organizerId
}

export default function AdminClient() {
  const supabase = useMemo(() => createClient(), [])

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  // Reject modal targets: one row (row button / R key) or the whole selection.
  const [rejectTargets, setRejectTargets] = useState<UnifiedRow[] | null>(null)

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [civicOnly, setCivicOnly] = useState(false)
  const [search, setSearch] = useState('')

  // Linear-style table state: multi-select, expanded detail rows, keyboard cursor.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)

  const [repostSource, setRepostSource] = useState<{ id: string; title: string } | null>(null)
  const [previewRow, setPreviewRow] = useState<UnifiedRow | null>(null)

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

  const approveSubmission = async (row: UnifiedRow, opts: { refresh?: boolean } = {}) => {
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

    const { data: insertedEvent, error: eventError } = await supabase
      .from('events')
      .insert({
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
        address_hint: s.address_hint ?? null,
        is_online: s.is_online ?? false,
        online_url: s.online_url ?? null,
        tags: s.tags ?? [],
        language: s.language ?? 'en',
        banner_url: s.banner_url ?? null,
        organizer_name: s.organizer_name ?? null,
        organizer_phone: s.organizer_phone ?? null,
        organizer_website: s.organizer_website ?? null,
        organizer_socials: s.organizer_socials ?? null,
        organizer_contact: s.organizer_contact ?? s.contact_email ?? null,
        recurrence: s.recurrence ?? 'none',
        recurrence_until: s.recurrence_until ?? null,
        recurrence_days_of_week: s.recurrence_days_of_week ?? [],
        recurrence_exceptions: s.recurrence_exceptions ?? [],
        ...(isCivic && {
          event_type: s.event_type ?? 'protest',
          is_civic: true,
          featured_movement_slug: s.featured_movement_slug ?? null,
          telegram_link: s.telegram_link ?? null,
          whatsapp_link: s.whatsapp_link ?? null,
          safety_notes: s.safety_notes ?? null,
          expected_attendees: s.expected_attendees ?? null,
        }),
      })
      .select('id')
      .single()

    if (eventError) {
      setActionId(null)
      setMessage(`Publish error: ${eventError.message}`)
      return
    }

    const newEventId = (insertedEvent as { id: string } | null)?.id ?? null

    const { error: subError } = await supabase
      .from('event_submissions')
      .update({ status: 'approved' })
      .eq('id', s.id)

    setActionId(null)
    if (subError) {
      setMessage(`Approve error: ${subError.message}`)
      return
    }

    // Fire-and-forget: tell the organizer their event is live. Failure here
    // shouldn't block the admin's flow — they already see the success state.
    if (newEventId) {
      const contactEmail = s.organizer_contact ?? s.contact_email ?? null
      void fetch('/api/admin/notify-event-published', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: newEventId, contactEmail }),
      }).catch(() => {})
    }

    if (opts.refresh !== false) await fetchAll()
  }

  const rejectSubmission = async (
    row: UnifiedRow,
    note: string,
    opts: { refresh?: boolean } = {},
  ) => {
    setActionId(row.key)
    setMessage(null)

    const { error } = await supabase
      .from('event_submissions')
      .update({
        status: 'rejected',
        ...(note.trim() ? { admin_note: note.trim() } : {}),
      })
      .eq('id', row.rowId)

    setActionId(null)
    if (error) {
      setMessage(`Reject error: ${error.message}`)
      return
    }
    if (opts.refresh !== false) await fetchAll()
  }

  // -- Event actions ----------------------------------------------------------

  const patchEventStatus = async (
    row: UnifiedRow,
    nextStatus: string,
    label: string,
    opts: { refresh?: boolean } = {},
  ) => {
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
      // Fire-and-forget organizer notification
      void fetch('/api/admin/notify-event-published', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: row.rowId }),
      }).catch(() => {})
      if (opts.refresh !== false) await fetchAll()
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
    // If a non-organizer event flips to 'published' via admin_update_event,
    // also notify (organizer_contact field on the event row provides the
    // recipient when there's no organizer_id linkage).
    if (nextStatus === 'published') {
      void fetch('/api/admin/notify-event-published', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: row.rowId }),
      }).catch(() => {})
    }
    if (opts.refresh !== false) await fetchAll()
  }

  const rejectEvent = async (
    row: UnifiedRow,
    note: string,
    opts: { refresh?: boolean } = {},
  ) => {
    setActionId(row.key)
    setMessage(null)

    if (row.organizerId) {
      const { error } = await supabase.rpc('admin_reject_event', {
        event_id: row.rowId,
        note: note.trim() || null,
      })
      setActionId(null)
      if (error) {
        setMessage(`Reject failed: ${error.message}`)
        return
      }
      if (opts.refresh !== false) await fetchAll()
      return
    }

    const { error } = await supabase.rpc('admin_update_event', {
      event_id: row.rowId,
      patch: {
        status: 'rejected',
        ...(note.trim() ? { admin_note: note.trim() } : {}),
      },
    })
    setActionId(null)
    if (error) {
      setMessage(`Reject failed: ${error.message}`)
      return
    }
    if (opts.refresh !== false) await fetchAll()
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

  // -- Selection + bulk operations ---------------------------------------------

  const approveRow = useCallback(
    (row: UnifiedRow, opts: { refresh?: boolean } = {}) =>
      row.source === 'submission'
        ? approveSubmission(row, opts)
        : patchEventStatus(row, 'published', 'Publish', opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submissions, supabase],
  )

  const selectedRows = useMemo(
    () => visible.filter((r) => selected.has(r.key)),
    [visible, selected],
  )

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectableVisible = useMemo(
    () => visible.filter((r) => canApprove(r) || canReject(r)),
    [visible],
  )
  const allVisibleSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((r) => selected.has(r.key))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allVisibleSelected) return new Set<string>()
      const next = new Set(prev)
      for (const r of selectableVisible) next.add(r.key)
      return next
    })
  }

  const runBulk = async (
    rows: UnifiedRow[],
    op: (row: UnifiedRow) => Promise<void>,
  ) => {
    setBulk({ done: 0, total: rows.length })
    for (let i = 0; i < rows.length; i++) {
      await op(rows[i])
      setBulk({ done: i + 1, total: rows.length })
    }
    setBulk(null)
    setSelected(new Set())
    await fetchAll()
  }

  const bulkApprove = () =>
    runBulk(
      selectedRows.filter(canApprove),
      (row) => approveRow(row, { refresh: false }),
    )

  const confirmReject = async (targets: UnifiedRow[], note: string) => {
    setRejectTargets(null)
    setRejectNote('')
    await runBulk(
      targets.filter(canReject),
      (row) =>
        row.source === 'submission'
          ? rejectSubmission(row, note, { refresh: false })
          : rejectEvent(row, note, { refresh: false }),
    )
  }

  // -- Keyboard: J/K move · X select · E approve · R reject · P preview --------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (previewRow || repostSource || rejectTargets || bulk) {
        if (e.key === 'Escape') {
          setPreviewRow(null)
          setRejectTargets(null)
          setRejectNote('')
        }
        return
      }
      if (visible.length === 0) return
      const row = visible[Math.min(activeIndex, visible.length - 1)]

      switch (e.key.toLowerCase()) {
        case 'j':
        case 'arrowdown':
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, visible.length - 1))
          break
        case 'k':
        case 'arrowup':
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
          break
        case 'x':
          if (row && (canApprove(row) || canReject(row))) toggleSelect(row.key)
          break
        case 'e':
          if (row && canApprove(row) && actionId === null) void approveRow(row)
          break
        case 'r':
          if (row && canReject(row)) setRejectTargets([row])
          break
        case 'p':
          if (row) {
            if (row.source === 'submission') setPreviewRow(row)
            else if (row.slug) window.open(`/events/${row.slug}`, '_blank')
          }
          break
        case 'enter':
        case 'o':
          if (row) {
            setExpanded((prev) => {
              const next = new Set(prev)
              if (next.has(row.key)) next.delete(row.key)
              else next.add(row.key)
              return next
            })
          }
          break
        case 'escape':
          setSelected(new Set())
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    visible,
    activeIndex,
    previewRow,
    repostSource,
    rejectTargets,
    bulk,
    actionId,
    approveRow,
    toggleSelect,
  ])

  // Keep the cursor in range when filters shrink the list.
  useEffect(() => {
    setActiveIndex((i) => Math.max(0, Math.min(i, Math.max(visible.length - 1, 0))))
  }, [visible.length])

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
          <Link
            href="/admin/placards"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Flame className="h-4 w-4" />
            Pankartat
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

      <div className="mt-5 hidden flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/35 lg:flex">
        <span><kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 font-sans">J</kbd>/<kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 font-sans">K</kbd> navigate</span>
        <span><kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 font-sans">X</kbd> select</span>
        <span><kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 font-sans">E</kbd> approve</span>
        <span><kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 font-sans">R</kbd> reject</span>
        <span><kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 font-sans">P</kbd> preview</span>
        <span><kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 font-sans">↵</kbd> details</span>
      </div>

      {!loading && visible.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-white/[0.04] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              <tr>
                <th className="w-10 px-3 py-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    aria-label={allVisibleSelected ? 'Clear selection' : 'Select all actionable'}
                    className="flex h-5 w-5 items-center justify-center text-white/45 transition hover:text-white"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="h-4 w-4 text-flame-300" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3">Event</th>
                <th className="hidden px-3 py-3 md:table-cell">When</th>
                <th className="hidden px-3 py-3 lg:table-cell">Where</th>
                <th className="hidden px-3 py-3 xl:table-cell">Age</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, idx) => (
                <QueueRow
                  key={row.key}
                  row={row}
                  active={idx === activeIndex}
                  isSelected={selected.has(row.key)}
                  isExpanded={expanded.has(row.key)}
                  isWorking={actionId === row.key}
                  onFocusRow={() => setActiveIndex(idx)}
                  onToggleSelect={() => toggleSelect(row.key)}
                  onToggleExpand={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(row.key)) next.delete(row.key)
                      else next.add(row.key)
                      return next
                    })
                  }
                  onApprove={() => void approveRow(row)}
                  onReject={() => setRejectTargets([row])}
                  onPreview={() => setPreviewRow(row)}
                  onPatchEventStatus={patchEventStatus}
                  onDelete={() =>
                    row.source === 'submission' ? deleteSubmission(row) : deleteEvent(row)
                  }
                  onRepost={() => setRepostSource({ id: row.rowId, title: row.title })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk action bar — appears with a selection, shows progress mid-run */}
      {(selected.size > 0 || bulk) && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-ink-900/95 px-5 py-2.5 text-sm shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur">
          {bulk ? (
            <span className="inline-flex items-center gap-2 font-semibold text-white">
              <Loader2 className="h-4 w-4 animate-spin text-flame-300" />
              Processing {bulk.done}/{bulk.total}…
            </span>
          ) : (
            <>
              <span className="font-semibold text-white">{selected.size} selected</span>
              {selectedRows.some(canApprove) && (
                <button
                  type="button"
                  onClick={() => void bulkApprove()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve {selectedRows.filter(canApprove).length}
                </button>
              )}
              {selectedRows.some(canReject) && (
                <button
                  type="button"
                  onClick={() => setRejectTargets(selectedRows.filter(canReject))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject {selectedRows.filter(canReject).length}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs font-semibold text-white/55 transition hover:text-white"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* Reject modal — one row or the whole selection, one shared note */}
      {rejectTargets && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Reject"
          onClick={() => {
            setRejectTargets(null)
            setRejectNote('')
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">
              {rejectTargets.length === 1
                ? `Reject “${rejectTargets[0].title}”?`
                : `Reject ${rejectTargets.length} items?`}
            </h3>
            <p className="mt-1 text-sm text-white/55">
              The note is sent to the submitter / organizer with the decision.
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Optional note — what should they fix?"
              rows={3}
              autoFocus
              className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTargets(null)
                  setRejectNote('')
                }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmReject(rejectTargets, rejectNote)}
                className="rounded-full bg-red-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
              >
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}

      {previewRow && (() => {
        const sub = submissions.find((item) => item.id === previewRow.rowId)
        if (!sub) return null
        const previewData: EventPreviewData = {
          title: sub.title,
          category: sub.category,
          date: sub.date,
          time: sub.time,
          end_time: sub.end_time,
          price: sub.price,
          description: sub.description,
          banner_url: sub.banner_url,
          gallery_urls: sub.gallery_urls,
          venue_name: sub.venue_name,
          address: sub.address,
          address_hint: sub.address_hint,
          cityLabel: getLocationBySlug(sub.location_slug)?.label ?? sub.location_slug,
          country: sub.country,
          is_online: sub.is_online,
          online_url: sub.online_url,
          is_civic: sub.is_civic,
          expected_attendees: sub.expected_attendees,
          telegram_link: sub.telegram_link,
          whatsapp_link: sub.whatsapp_link,
          safety_notes: sub.safety_notes,
          tags: sub.tags,
          organizer_name: sub.organizer_name,
        }
        const isPending = previewRow.unifiedStatus === 'pending'
        return (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="Preview event page"
            onClick={() => setPreviewRow(null)}
          >
            <div
              className="w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                  Page preview — this is what visitors will see
                </p>
                <button
                  type="button"
                  onClick={() => setPreviewRow(null)}
                  aria-label="Close preview"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <EventPagePreview event={previewData} />

              {isPending && (
                <div className="mt-4 flex flex-wrap justify-end gap-2 pb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewRow(null)
                      setRejectTargets([previewRow])
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={actionId === previewRow.key}
                    onClick={() => {
                      setPreviewRow(null)
                      void approveSubmission(previewRow)
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                    Approve & publish
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

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

function QueueRow(props: {
  row: UnifiedRow
  active: boolean
  isSelected: boolean
  isExpanded: boolean
  isWorking: boolean
  onFocusRow: () => void
  onToggleSelect: () => void
  onToggleExpand: () => void
  onApprove: () => void
  onReject: () => void
  onPreview: () => void
  onPatchEventStatus: (row: UnifiedRow, nextStatus: string, label: string) => void
  onDelete: () => void
  onRepost: () => void
}) {
  const {
    row,
    active,
    isSelected,
    isExpanded,
    isWorking,
    onFocusRow,
    onToggleSelect,
    onToggleExpand,
    onApprove,
    onReject,
    onPreview,
    onPatchEventStatus,
    onDelete,
    onRepost,
  } = props

  const selectable = canApprove(row) || canReject(row)
  const sourceBadge =
    row.source === 'submission'
      ? 'submission'
      : row.organizerId
        ? 'organizer'
        : 'event'

  const iconBtn =
    'flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-40'

  return (
    <>
      <tr
        onClick={onFocusRow}
        className={[
          'cursor-default border-t border-white/[0.06] transition',
          active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]',
          isSelected ? 'bg-flame-500/[0.06]' : '',
        ].join(' ')}
      >
        <td className="px-3 py-2.5 align-middle">
          {selectable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect()
              }}
              aria-label={isSelected ? 'Deselect' : 'Select'}
              className="flex h-5 w-5 items-center justify-center text-white/45 transition hover:text-white"
            >
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-flame-300" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="block h-5 w-5" />
          )}
        </td>
        <td className="max-w-[280px] px-3 py-2.5">
          <div className="flex items-center gap-2">
            {active && <span className="h-4 w-0.5 shrink-0 rounded bg-flame-500" aria-hidden />}
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{row.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/45">
                <span className="uppercase tracking-wide">{sourceBadge}</span>
                {row.isCivic && (
                  <span className="inline-flex items-center gap-0.5 text-flame-300">
                    <Flame className="h-3 w-3" />
                    civic
                  </span>
                )}
                <span className="capitalize">{row.category}</span>
              </p>
            </div>
          </div>
        </td>
        <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-white/65 md:table-cell">
          {row.date}
          {row.time ? ` · ${row.time.slice(0, 5)}` : ''}
        </td>
        <td className="hidden max-w-[160px] truncate px-3 py-2.5 text-xs text-white/65 lg:table-cell">
          {row.locationSlug}
          {row.country ? ` · ${row.country}` : ''}
        </td>
        <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-white/45 xl:table-cell">
          {timeAgo(row.createdAt)}
        </td>
        <td className="px-3 py-2.5">
          <span
            className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(row.unifiedStatus)}`}
          >
            {statusLabel(row)}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1.5">
            {isWorking ? (
              <Loader2 className="h-4 w-4 animate-spin text-flame-300" />
            ) : (
              <>
                {row.source === 'submission' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreview()
                    }}
                    title="Preview page (P)"
                    className={`${iconBtn} border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.10] hover:text-white`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  row.slug && (
                    <Link
                      href={`/events/${row.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Open live page (P)"
                      className={`${iconBtn} border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.10] hover:text-white`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  )
                )}
                {canApprove(row) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onApprove()
                    }}
                    title={row.source === 'submission' ? 'Approve & publish (E)' : 'Publish (E)'}
                    className={`${iconBtn} border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                {canReject(row) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReject()
                    }}
                    title="Reject (R)"
                    className={`${iconBtn} border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/25`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleExpand()
                  }}
                  title="Details (Enter)"
                  className={`${iconBtn} border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.10] hover:text-white`}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-t border-white/[0.04] bg-white/[0.015]">
          <td colSpan={7} className="px-5 py-4">
            <QueueRowDetail
              row={row}
              isWorking={isWorking}
              onPatchEventStatus={onPatchEventStatus}
              onDelete={onDelete}
              onRepost={onRepost}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function QueueRowDetail({
  row,
  isWorking,
  onPatchEventStatus,
  onDelete,
  onRepost,
}: {
  row: UnifiedRow
  isWorking: boolean
  onPatchEventStatus: (row: UnifiedRow, nextStatus: string, label: string) => void
  onDelete: () => void
  onRepost: () => void
}) {

  return (
    <div className="space-y-3">
      {row.description && (
        <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-white/70">
          {row.description}
        </p>
      )}

      {row.featuredMovementSlug && (
        <p className="text-xs text-white/55">
          Movement:{' '}
          <code className="rounded bg-white/10 px-1 text-[10px]">
            {row.featuredMovementSlug}
          </code>
        </p>
      )}

      {row.contactEmail && (
        <p className="text-xs text-white/55">
          Contact: <span className="text-white/80">{row.contactEmail}</span>
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

      {/* Secondary actions — approve/reject/preview live on the table row */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {row.source === 'event' && (
          <>
            <Link
              href={`/admin/events/${row.rowId}/edit`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>

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
              onClick={onRepost}
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
          onClick={onDelete}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/[0.04] px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15 disabled:opacity-40"
          title="Permanently delete"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  )
}
