'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import LandingNavbar from '@/components/layout/LandingNavbar'

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

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

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
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-[#070b14] px-6 pb-6 pt-24 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Review Submissions</h1>
        <p className="mt-2 text-sm text-white/50">
          Approve or reject submitted events before publishing.
        </p>

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
                </div>

                <p className="mt-4 text-sm leading-6 text-white/70">
                  {submission.description}
                </p>

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
      </div>
    </main>
    </>
  )
}
