'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarRange, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import OrganizerQueue from './OrganizerQueue'

type AdminView = 'submissions' | 'organizer'

type Submission = {
  id: string
  title: string
  venue_name: string
  place_id: string | null
  category: string
  description: string
  date: string
  time: string
  price: string | null
  contact_email: string
  status: string
  admin_note: string | null
  created_at: string
  country: string
  region: string | null
  location_slug: string
  // Phase 8.3 civic columns. Nullable for legacy submissions made before the
  // migration was applied (or for non-civic submissions today).
  event_type?: string | null
  is_civic?: boolean | null
  featured_movement_slug?: string | null
  organizer_contact?: string | null
  telegram_link?: string | null
  whatsapp_link?: string | null
  safety_notes?: string | null
  expected_attendees?: number | null
  lat?: number | null
  lng?: number | null
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'border-green-500/20 bg-green-500/10 text-green-400'
  if (status === 'rejected') return 'border-red-500/20 bg-red-500/10 text-red-400'
  return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
}

export default function AdminClient() {
  const supabase = useMemo(() => createClient(), [])

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [view, setView] = useState<AdminView>('submissions')

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('event_submissions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Error loading submissions: ${error.message}`)
      setLoading(false)
      return
    }

    setSubmissions(data ?? [])
    setLoading(false)
  }

  const counts = useMemo(() => ({
    all: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
  }), [submissions])

  const visibleSubmissions = useMemo(() =>
    statusFilter === 'all'
      ? submissions
      : submissions.filter((s) => s.status === statusFilter),
    [submissions, statusFilter]
  )

  const approveSubmission = async (submission: Submission) => {
    setActionId(submission.id)
    setMessage(null)

    const slug = `${createSlug(submission.title)}-${submission.id.slice(0, 8)}`

    const isCivic = submission.is_civic === true || submission.category === 'civic'

    const { error: eventError } = await supabase.from('events').insert({
      title: submission.title,
      slug,
      place_id: submission.place_id ?? null,
      category: submission.category,
      description: submission.description,
      date: submission.date,
      time: submission.time,
      price: submission.price ?? null,
      highlight: false,
      status: 'published',
      country: submission.country,
      region: submission.region,
      location_slug: submission.location_slug,
      // Carry civic context through to the published event. All nullable on
      // the events table, so passing them for non-civic submissions is a no-op.
      ...(isCivic && {
        event_type: submission.event_type ?? 'protest',
        is_civic: true,
        featured_movement_slug: submission.featured_movement_slug ?? null,
        organizer_contact: submission.organizer_contact ?? submission.contact_email,
        telegram_link: submission.telegram_link ?? null,
        whatsapp_link: submission.whatsapp_link ?? null,
        safety_notes: submission.safety_notes ?? null,
        expected_attendees: submission.expected_attendees ?? null,
        lat: submission.lat ?? null,
        lng: submission.lng ?? null,
      }),
    })

    if (eventError) {
      setActionId(null)
      setMessage(`Publish error: ${eventError.message}`)
      return
    }

    const { error } = await supabase
      .from('event_submissions')
      .update({ status: 'approved' })
      .eq('id', submission.id)

    setActionId(null)

    if (error) {
      setMessage(`Approve error: ${error.message}`)
      return
    }

    await fetchSubmissions()
  }

  const rejectSubmission = async (submission: Submission) => {
    setActionId(submission.id)
    setMessage(null)

    const { error } = await supabase
      .from('event_submissions')
      .update({
        status: 'rejected',
        ...(rejectNote.trim() ? { admin_note: rejectNote.trim() } : {}),
      })
      .eq('id', submission.id)

    setActionId(null)
    setRejectingId(null)
    setRejectNote('')

    if (error) {
      setMessage(`Reject error: ${error.message}`)
      return
    }

    await fetchSubmissions()
  }

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'all', label: 'All' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="mt-2 text-sm text-white/50">
            Moderate community submissions, organizer events, and volunteer signups.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
          >
            <CalendarRange className="h-4 w-4" />
            Events &amp; protests
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

      <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setView('submissions')}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold transition',
            view === 'submissions'
              ? 'bg-white text-black'
              : 'text-white/70 hover:text-white',
          ].join(' ')}
        >
          Submissions
        </button>
        <button
          type="button"
          onClick={() => setView('organizer')}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold transition',
            view === 'organizer'
              ? 'bg-white text-black'
              : 'text-white/70 hover:text-white',
          ].join(' ')}
        >
          Organizer queue
        </button>
      </div>

      {view === 'organizer' && (
        <div className="mt-8">
          <OrganizerQueue />
        </div>
      )}

      {view === 'submissions' && (
        <>
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
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
            <span className={[
              'rounded-full px-2 py-0.5 text-xs',
              statusFilter === tab.key ? 'bg-white/15' : 'bg-white/[0.06]',
            ].join(' ')}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {message && (
        <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">
          {message}
        </div>
      )}

      {loading && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          Loading submissions...
        </div>
      )}

      {!loading && visibleSubmissions.length === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          No {statusFilter === 'all' ? '' : statusFilter} submissions.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {visibleSubmissions.map((submission) => {
          const isPending = submission.status === 'pending'
          const isWorking = actionId === submission.id
          const isRejectingThis = rejectingId === submission.id

          return (
            <article
              key={submission.id}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{submission.title}</h2>
                  <p className="mt-1 text-sm text-white/55">
                    {submission.venue_name}
                    {submission.place_id && (
                      <span className="ml-2 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                        venue linked
                      </span>
                    )}
                    {submission.is_civic && (
                      <span className="ml-2 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-2 py-0.5 text-xs text-flame-300">
                        civic
                      </span>
                    )}
                    {' · '}
                    {submission.category}
                    {' · '}
                    {submission.location_slug}
                  </p>
                </div>

                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusBadgeClass(submission.status)}`}>
                  {submission.status}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-white/60 sm:grid-cols-2">
                <p>Date: {submission.date}</p>
                <p>Time: {submission.time}</p>
                {submission.price && <p>Price: {submission.price}</p>}
                <p>Email: {submission.contact_email}</p>
                <p>Submitted: {new Date(submission.created_at).toLocaleString()}</p>
                {submission.is_civic && submission.lat != null && submission.lng != null && (
                  <p className="font-mono text-xs">
                    Coords: {submission.lat.toFixed(4)}, {submission.lng.toFixed(4)}
                  </p>
                )}
              </div>

              <p className="mt-4 text-sm leading-6 text-white/70">
                {submission.description}
              </p>

              {submission.is_civic && (
                <div className="mt-4 rounded-2xl border border-flame-500/20 bg-flame-500/[0.04] p-4 space-y-2 text-sm text-white/70">
                  <div className="font-semibold text-white/85">Civic gathering context</div>
                  {submission.expected_attendees != null && (
                    <p>Expected attendees: {submission.expected_attendees.toLocaleString()}</p>
                  )}
                  {submission.featured_movement_slug && (
                    <p>Movement: <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{submission.featured_movement_slug}</code></p>
                  )}
                  {submission.telegram_link && (
                    <p>
                      Telegram:{' '}
                      <a href={submission.telegram_link} target="_blank" rel="noopener noreferrer" className="text-flame-300 underline-offset-2 hover:underline">
                        {submission.telegram_link}
                      </a>
                    </p>
                  )}
                  {submission.whatsapp_link && (
                    <p>
                      WhatsApp:{' '}
                      <a href={submission.whatsapp_link} target="_blank" rel="noopener noreferrer" className="text-flame-300 underline-offset-2 hover:underline">
                        {submission.whatsapp_link}
                      </a>
                    </p>
                  )}
                  {submission.safety_notes && (
                    <p className="leading-6"><span className="font-medium text-white/80">Safety:</span> {submission.safety_notes}</p>
                  )}
                </div>
              )}

              {submission.admin_note && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/60">
                  <span className="font-semibold text-white/80">Admin note: </span>
                  {submission.admin_note}
                </div>
              )}

              {isPending && (
                <div className="mt-5 space-y-3">
                  {isRejectingThis ? (
                    <div className="space-y-3">
                      <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Optional note for the submitter..."
                        rows={2}
                        className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => rejectSubmission(submission)}
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
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => approveSubmission(submission)}
                        className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-40"
                      >
                        {isWorking ? 'Approving...' : 'Approve'}
                      </button>

                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => setRejectingId(submission.id)}
                        className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
        </>
      )}
    </div>
  )
}
