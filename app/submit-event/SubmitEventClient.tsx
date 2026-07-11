'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  CloudUpload,
  LogIn,
  PencilLine,
  ScanLine,
  UserPlus,
} from 'lucide-react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import { createClient } from '@/lib/supabase/browser'
import { trackInteraction } from '@/lib/track'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { submitCommunityEvent } from '@/lib/wizardSubmit'
import type { EventDraft } from '@/types/eventDraft'

// After signing in, the auth callback sends the user back here with
// ?resume=1 so we drop them on the review step — one click from submit —
// instead of step 1 of a wizard they already filled in.
const RETURN_PATH = '/submit-event?resume=1'

type GateVariant = 'intro' | 'final'

export default function SubmitEventClient() {
  const { t } = useLanguage()
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const resumeAtReview = searchParams.get('resume') === '1'

  const [submittedId, setSubmittedId] = useState<string | null>(null)
  // null = still checking; signed-out UI only renders once we know.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const [gate, setGate] = useState<GateVariant | null>(null)

  // Greet signed-out visitors once per page visit with the dismissible intro
  // popup, so the sign-in requirement is never a surprise at the end.
  const introShownRef = useRef(false)

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
      // Signed in (this tab or another) → both gates are moot.
      if (session?.user) setGate(null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    // Funnel entry: fires once per page visit (resume returns are flagged so
    // they don't read as fresh starts in the numbers).
    trackInteraction('submit_started', { meta: { resume: resumeAtReview } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (introShownRef.current) return
    if (isAuthed !== false) return
    // Returning from sign-in/sign-up they're authed; this only covers a user
    // who came back signed-out (e.g. abandoned the auth page).
    introShownRef.current = true
    setGate((current) => current ?? 'intro')
  }, [isAuthed])

  const handleSubmit = async (draft: EventDraft) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setGate('final')
      // Outcome handled here (auth gate modal) — the wizard keeps the draft.
      return { id: null, error: null }
    }
    return submitCommunityEvent(supabase, draft)
  }

  if (submittedId) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-4 text-2xl font-bold text-white">
            {t('submit_received_title')}
          </h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            {t('submit_received_body')}
          </p>
          <p className="mt-3 text-xs text-white/45">
            {t('submit_reference')} <span className="font-mono">{submittedId}</span>
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
            >
              {t('submit_browse_events')}
            </Link>
            <button
              type="button"
              onClick={() => setSubmittedId(null)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
            >
              {t('submit_another')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/scan"
        className="group mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-flame-500/30 hover:bg-white/[0.05]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <ScanLine className="h-4 w-4 text-flame-400" />
          </div>
          <p className="text-sm text-white/80">{t('lens_entry_title')}</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white transition group-hover:bg-white/[0.10]">
          {t('lens_entry_cta')}
        </span>
      </Link>
      {isAuthed === false && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-flame-500/25 bg-flame-500/[0.08] px-4 py-3">
          <p className="text-sm text-white/80">
            {t('submit_signin_banner')}
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent(RETURN_PATH)}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.10]"
          >
            <LogIn className="h-3.5 w-3.5" />
            {t('submit_sign_in_now')}
          </Link>
        </div>
      )}

      <EventCreationWizard
        mode="community"
        onSubmit={handleSubmit}
        onSuccess={(id) => {
          trackInteraction('submit_completed', {
            entityType: 'submission',
            entityId: id,
          })
          setSubmittedId(id)
        }}
        initialStepKey={resumeAtReview ? 'review' : undefined}
      />

      {gate && (
        <AuthGateModal variant={gate} onDismiss={() => setGate(null)} />
      )}
    </div>
  )
}

function AuthGateModal({
  variant,
  onDismiss,
}: {
  variant: GateVariant
  onDismiss: () => void
}) {
  const { t } = useLanguage()
  const isIntro = variant === 'intro'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role={isIntro ? 'dialog' : 'alertdialog'}
      aria-modal="true"
      aria-labelledby="auth-gate-title"
    >
      {isIntro ? (
        // Intro is informational — clicking outside closes it.
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="absolute inset-0 cursor-default bg-ink-950/85 backdrop-blur-sm"
        />
      ) : (
        // Final gate: signing in is required to finish, so the only ways out
        // are the explicit buttons below (or Escape).
        <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" />
      )}
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-8 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-flame-500/30 bg-flame-500/10">
          {isIntro ? (
            <PencilLine className="h-6 w-6 text-flame-300" />
          ) : (
            <LogIn className="h-6 w-6 text-flame-300" />
          )}
        </div>
        <h2 id="auth-gate-title" className="mt-5 text-xl font-bold text-white">
          {isIntro ? t('submit_gate_intro_title') : t('submit_gate_signin_title')}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/65">
          {isIntro ? t('submit_gate_intro_body') : t('submit_gate_signin_body')}
        </p>
        <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-200">
          <CloudUpload className="h-3.5 w-3.5" />
          {isIntro ? t('submit_gate_draft_saves') : t('submit_gate_saved_all')}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {isIntro ? (
            <>
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
              >
                <PencilLine className="h-4 w-4" />
                {t('submit_start_my_event')}
              </button>
              <Link
                href={`/sign-in?next=${encodeURIComponent(RETURN_PATH)}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
              >
                <LogIn className="h-4 w-4" />
                {t('submit_sign_in')}
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/sign-in?next=${encodeURIComponent(RETURN_PATH)}`}
                className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
              >
                <LogIn className="h-4 w-4" />
                {t('submit_sign_in')}
              </Link>
              <Link
                href={`/sign-up?next=${encodeURIComponent(RETURN_PATH)}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
              >
                <UserPlus className="h-4 w-4" />
                {t('submit_create_account')}
              </Link>
            </>
          )}
        </div>
        {!isIntro && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-6 text-xs text-white/45 transition hover:text-white/75"
          >
            {t('submit_back_to_draft')}
          </button>
        )}
      </div>
    </div>
  )
}
