'use client'

import { useEffect, useState } from 'react'
import { Loader2, RotateCcw, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type Props = {
  sourceEventId: string
  sourceTitle: string
  onClose: () => void
  onCreated: () => void
}

export default function AdminRepostModal({
  sourceEventId,
  sourceTitle,
  onClose,
  onCreated,
}: Props) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submitting, onClose])

  const handleSubmit = async () => {
    setError(null)
    if (!date) {
      setError('Pick a new date.')
      return
    }
    if (time && endTime && endTime <= time) {
      setError('End time must be after start time.')
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('admin_repost_event', {
      source_event_id: sourceEventId,
      new_date: date,
      new_time: time || null,
      new_end_time: endTime || null,
    })
    setSubmitting(false)

    if (rpcError) {
      if (rpcError.code === '42501') {
        setError(
          'Repost not allowed. The admin_repost_event RPC may be missing — see docs/seeds/phase-19-admin-repost.sql.',
        )
        return
      }
      if (/function .* does not exist/i.test(rpcError.message)) {
        setError(
          'admin_repost_event RPC is missing. Apply docs/seeds/phase-19-admin-repost.sql in Supabase.',
        )
        return
      }
      setError(rpcError.message)
      return
    }

    onCreated()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-flame-500/30 bg-flame-500/[0.08]">
              <RotateCcw className="h-4 w-4 text-flame-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Repost event</h2>
              <p className="mt-0.5 truncate text-xs text-white/55">
                {sourceTitle || sourceEventId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!submitting) onClose()
            }}
            disabled={submitting}
            className="rounded-full p-1.5 text-white/55 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm text-white/65">
          Creates a new draft event with the same content but a new schedule.
          The original event stays untouched and the original organizer keeps
          ownership.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="repost-date"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
            >
              New date
            </label>
            <input
              id="repost-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/25"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="repost-time"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
              >
                Start time
              </label>
              <input
                id="repost-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/25"
              />
            </div>
            <div>
              <label
                htmlFor="repost-end-time"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
              >
                End time
              </label>
              <input
                id="repost-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/25"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/[0.07] p-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (!submitting) onClose()
            }}
            disabled={submitting}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reposting…
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Create repost
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
