'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Flag, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type Props = {
  eventId: string
}

type Reason = 'spam' | 'misleading' | 'inappropriate' | 'duplicate' | 'other'

const REASONS: { value: Reason; label: string; help: string }[] = [
  {
    value: 'spam',
    label: 'Spam or promotion',
    help: 'Repeated posts, off-topic promotion, or scams.',
  },
  {
    value: 'misleading',
    label: 'Misleading information',
    help: 'Wrong date, fake venue, or false claims about the event.',
  },
  {
    value: 'inappropriate',
    label: 'Inappropriate content',
    help: 'Hateful, violent, or otherwise harmful content.',
  },
  {
    value: 'duplicate',
    label: 'Duplicate event',
    help: 'Same event posted multiple times.',
  },
  {
    value: 'other',
    label: 'Something else',
    help: 'Tell us what’s wrong in the details below.',
  },
]

export default function ReportEventButton({ eventId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<Reason | null>(null)
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const close = () => {
    if (isSubmitting) return
    setIsOpen(false)
    setTimeout(() => {
      setReason(null)
      setDetails('')
      setSuccess(false)
      setErrorMessage(null)
    }, 200)
  }

  const handleOpen = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname ?? '/')}`)
      return
    }
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!reason) {
      setErrorMessage('Please pick a reason.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)

    const { error } = await supabase.rpc('report_event', {
      p_event_id: eventId,
      p_reason: reason,
      p_details: details.trim() || null,
    })

    setIsSubmitting(false)

    if (error) {
      console.error('[report_event]', error.message)
      setErrorMessage(
        /rate limit/i.test(error.message)
          ? "You've sent several reports recently — please try again later."
          : "Couldn't send your report — please try again in a moment.",
      )
      return
    }
    setSuccess(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 text-xs text-white/35 transition hover:text-white/70"
      >
        <Flag className="h-3 w-3" />
        Report this event
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-t-[32px] border border-white/10 bg-ink-900 p-6 sm:rounded-[32px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Report this event
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  We review every report. Repeated abuse is auto-flagged.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {success ? (
              <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-green-300" />
                <p className="mt-3 text-sm text-green-100">
                  Thanks — we&apos;ve received your report. An admin will review
                  it soon.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-flame-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-flame-400"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                        reason === r.value
                          ? 'border-flame-500/30 bg-flame-500/[0.08]'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="mt-1 h-4 w-4 accent-flame-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {r.label}
                        </p>
                        <p className="mt-0.5 text-xs text-white/55">{r.help}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                    Anything else? (Optional)
                  </span>
                  <textarea
                    rows={3}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Add context for the admin reviewer."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-flame-500/40 focus:ring-2 focus:ring-flame-500/20"
                  />
                </label>

                {errorMessage && (
                  <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 text-sm font-semibold shadow-[0_12px_30px_-12px_rgba(238,28,37,0.6)] transition hover:bg-flame-400 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Sending...' : 'Send report'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
