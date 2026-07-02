'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, CloudUpload, LogIn, UserPlus } from 'lucide-react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import { createClient } from '@/lib/supabase/browser'
import { submitCommunityEvent } from '@/lib/wizardSubmit'
import type { EventDraft } from '@/types/eventDraft'

// After signing in, the auth callback sends the user back here with
// ?resume=1 so we drop them on the review step — one click from submit —
// instead of step 1 of a wizard they already filled in.
const RETURN_PATH = '/submit-event?resume=1'

export default function SubmitEventClient() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const resumeAtReview = searchParams.get('resume') === '1'

  const [submittedId, setSubmittedId] = useState<string | null>(null)
  // null = still checking; the banner and gate only render once we know.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const [showAuthGate, setShowAuthGate] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) setIsAuthed(!!user)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session?.user)
      if (session?.user) setShowAuthGate(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleSubmit = async (draft: EventDraft) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setShowAuthGate(true)
      // The gate replaces the wizard, so this message is a fallback that
      // normally never renders.
      return { id: null, error: 'Sign in to submit your event.' }
    }
    return submitCommunityEvent(supabase, draft)
  }

  if (submittedId) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-4 text-2xl font-bold text-white">
            Submission received
          </h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            Thanks — your event is in the moderation queue. We&apos;ll review it
            shortly and notify you when it&apos;s published.
          </p>
          <p className="mt-3 text-xs text-white/45">
            Reference: <span className="font-mono">{submittedId}</span>
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
            >
              Browse events
            </Link>
            <button
              type="button"
              onClick={() => setSubmittedId(null)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
            >
              Submit another
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showAuthGate) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-flame-500/30 bg-flame-500/10">
            <LogIn className="h-6 w-6 text-flame-300" />
          </div>
          <h2 className="mt-5 text-2xl font-bold text-white">
            Sign in to submit your event
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/60">
            Your event is ready to go — we just need to know who&apos;s
            submitting it so we can follow up when it&apos;s published.
          </p>
          <p className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-200">
            <CloudUpload className="h-3.5 w-3.5" />
            Your draft is saved on this device — it&apos;ll be waiting when you
            get back.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={`/sign-in?next=${encodeURIComponent(RETURN_PATH)}`}
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
            <Link
              href={`/sign-up?next=${encodeURIComponent(RETURN_PATH)}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
            >
              <UserPlus className="h-4 w-4" />
              Create account
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setShowAuthGate(false)}
            className="mt-6 text-xs text-white/45 transition hover:text-white/75"
          >
            Back to your draft
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {isAuthed === false && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-flame-500/25 bg-flame-500/[0.08] px-4 py-3">
          <p className="text-sm text-white/80">
            You&apos;ll need to sign in to submit — your draft saves
            automatically on this device as you go.
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent(RETURN_PATH)}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.10]"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in now
          </Link>
        </div>
      )}
      <EventCreationWizard
        mode="community"
        onSubmit={handleSubmit}
        onSuccess={(id) => setSubmittedId(id)}
        initialStepKey={resumeAtReview ? 'review' : undefined}
      />
    </div>
  )
}
