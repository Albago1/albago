'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

type Submission = {
  id: string
  title: string
  venue_name: string
  category: string
  description: string
  date: string
  time: string
  contact_email: string
  status: string
  created_at: string
  country: string
  region: string | null
  location_slug: string
}
function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export default function AdminPage() {
  const supabase = createClient()

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You are not signed in.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      setMessage(`Profile error: ${profileError.message}`)
      setLoading(false)
      return
    }

    if (profile?.role !== 'admin') {
      setMessage('You are signed in, but you are not an admin.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('event_submissions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Submission error: ${error.message}`)
      setLoading(false)
      return
    }

    setSubmissions(data || [])
    setLoading(false)
  }

const updateSubmissionStatus = async (
  submission: Submission,
  status: 'approved' | 'rejected'
) => {
  setActionId(submission.id)
  setMessage(null)

  if (status === 'approved') {
    const slug = `${createSlug(submission.title)}-${submission.id.slice(0, 8)}`

    const { error: eventError } = await supabase.from('events').insert({
      title: submission.title,
      slug,
      place_id: null,
      category: submission.category,
      description: submission.description,
      date: submission.date,
      time: submission.time,
      price: null,
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
  }

  const { error } = await supabase
    .from('event_submissions')
    .update({ status })
    .eq('id', submission.id)

  setActionId(null)

  if (error) {
    setMessage(`${status} error: ${error.message}`)
    return
  }

  await fetchSubmissions()
}

  return (
    <main className="min-h-screen bg-[#070b14] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>

        <p className="mt-2 text-sm text-white/50">
          Review submitted events before publishing.
        </p>

        {loading && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
            Loading submissions...
          </div>
        )}

        {message && (
          <div className="mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">
            {message}
          </div>
        )}

        {!loading && !message && submissions.length === 0 && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
            No submissions yet.
          </div>
        )}

        <div className="mt-8 space-y-4">
          {submissions.map((submission) => {
            const isPending = submission.status === 'pending'
            const isWorking = actionId === submission.id

            return (
              <article
                key={submission.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{submission.title}</h2>
                    <p className="mt-1 text-sm text-white/55">
                      {submission.venue_name} · {submission.category}
                    </p>
                  </div>

                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase text-white/70">
                    {submission.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-white/60 sm:grid-cols-2">
                  <p>Date: {submission.date}</p>
                  <p>Time: {submission.time}</p>
                  <p>Email: {submission.contact_email}</p>
                  <p>Created: {new Date(submission.created_at).toLocaleString()}</p>
                </div>

                <p className="mt-4 text-sm leading-6 text-white/70">
                  {submission.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!isPending || isWorking}
                    onClick={() =>
                      updateSubmissionStatus(submission, 'approved')
                    }
                    className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isWorking ? 'Working...' : 'Approve'}
                  </button>

                  <button
                    type="button"
                    disabled={!isPending || isWorking}
                    onClick={() =>
                      updateSubmissionStatus(submission, 'rejected')
                    }
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isWorking ? 'Working...' : 'Reject'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}