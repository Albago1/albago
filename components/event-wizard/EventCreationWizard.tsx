'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from 'lucide-react'
import SubmitErrorModal from './SubmitErrorModal'
import type { EventDraft } from '@/types/eventDraft'
import { useEventDraft } from '@/types/eventDraft'
import EventTypeStep from './steps/EventTypeStep'
import CategoryStep from './steps/CategoryStep'
import BasicsStep from './steps/BasicsStep'
import WhenStep from './steps/WhenStep'
import WhereStep from './steps/WhereStep'
import MediaStep from './steps/MediaStep'
import TicketsStep from './steps/TicketsStep'
import OrganizerStep from './steps/OrganizerStep'
import ReviewStep from './steps/ReviewStep'

export type WizardSubmit = (draft: EventDraft) => Promise<
  | { id: string; error: null }
  // { id: null, error: null } means the caller handled the outcome itself
  // (e.g. showed its own auth gate) — the wizard keeps the draft and stays put.
  | { id: null; error: string | null }
>

export type WizardMode = 'community' | 'organizer' | 'admin'

export type StepKey = 'type' | 'category' | 'basics' | 'when' | 'where' | 'media' | 'tickets' | 'organizer' | 'review'

type Props = {
  /** What does the wizard call when the user hits Submit? */
  onSubmit: WizardSubmit
  /** Influences copy + which fields are required. */
  mode: WizardMode
  /** Where to send the user after a successful submit. */
  onSuccess?: (id: string) => void
  /** Optional starting step (one-shot, applied after the draft hydrates). */
  initialStepKey?: StepKey
  /** Overrides the mode's default header subtitle (e.g. tier-aware copy). */
  subtitle?: string
  /** Overrides the mode-derived H1 (e.g. "Edit event"). */
  heading?: string
  /** Label for the final submit button. Default "Submit". */
  submitLabel?: string
  /** Title for the submit-failure modal. Default "Couldn't submit your event". */
  errorTitle?: string
  /** Replaces the built-in "Reset draft" button (edit mode uses this to
   *  restore the saved event instead of wiping to a blank draft). */
  resetControl?: { label: string; confirmText: string; onReset: () => void }
}

type StepDef = {
  key: StepKey
  label: string
  validate: (draft: EventDraft) => string | null
  /** If true, this step is skipped under some draft conditions. */
  skip?: (draft: EventDraft) => boolean
}

const STEPS: StepDef[] = [
  {
    // Type + category merged into one screen (audit P2 #8): both were
    // single-choice steps, and category only exists for non-protest events
    // (protest auto-sets category to 'civic').
    key: 'type',
    label: 'Type',
    validate: (d) => {
      if (!d.event_type) return 'Pick an event type.'
      if (d.event_type !== 'protest' && !d.category) return 'Pick a category.'
      return null
    },
  },
  {
    key: 'basics',
    label: 'Basics',
    validate: (d) => {
      if (!d.title.trim()) return 'Title is required.'
      if (d.title.trim().length < 3) return 'Title is too short.'
      if (!d.description.trim()) return 'Description is required.'
      if (d.description.trim().length < 20)
        return 'Description should be at least 20 characters so people know what this is.'
      return null
    },
  },
  {
    key: 'when',
    label: 'When',
    validate: (d) => {
      if (!d.date) return 'Pick a date.'
      // Date input gives YYYY-MM-DD. Compare as ISO strings against today.
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const picked = new Date(d.date + 'T00:00:00')
      if (Number.isNaN(picked.getTime())) return 'Date is invalid.'
      if (picked < today) return 'Date is in the past.'
      if (d.end_time && d.time && d.end_time <= d.time) {
        return 'End time must be after start time.'
      }
      return null
    },
  },
  {
    key: 'where',
    label: 'Where',
    validate: (d) => {
      if (d.is_online) {
        if (!d.online_url.trim()) return 'Add an online URL.'
        try {
          // Accept anything URL-shaped; minimal sanity check.
          new URL(d.online_url)
        } catch {
          return 'Online URL is not valid.'
        }
        return null
      }
      if (d.lat == null || d.lng == null) {
        return 'Pick a location on the map.'
      }
      if (!d.location_slug) return 'Pick a location on the map.'
      return null
    },
  },
  {
    key: 'media',
    label: 'Media',
    // Cover image is optional.
    validate: () => null,
  },
  {
    // Phase 33: optional free AlbaGo tickets. Only organizer/admin modes see
    // this step (community events don't exist until approval — filtered in
    // activeSteps); civic events never get tiers (schema guard), so the step
    // disappears entirely for protests.
    key: 'tickets',
    label: 'Tickets',
    validate: (d) => {
      if (!d.ticket_tiers) return null
      if (d.ticket_tiers.length === 0) {
        return 'Add at least one ticket type, or choose "No tickets".'
      }
      for (const tier of d.ticket_tiers) {
        if (!tier.name.trim()) return 'Every ticket type needs a name.'
        const capacity = Number(tier.capacity)
        if (!Number.isInteger(capacity) || capacity < 1) {
          return 'Capacity must be a whole number of at least 1.'
        }
        if (capacity > 100000) return 'Capacity looks unrealistically large.'
        const maxPerOrder = Number(tier.maxPerOrder)
        if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 10) {
          return 'Max per person must be between 1 and 10.'
        }
      }
      return null
    },
    skip: (d) => d.event_type === 'protest' || d.is_civic,
  },
  {
    key: 'organizer',
    label: 'Organizer',
    validate: (d) => {
      if (!d.organizer_name.trim()) return 'Organizer name is required.'
      if (!d.organizer_contact.trim()) return 'Contact email is required.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.organizer_contact.trim())) {
        return 'Contact email looks invalid.'
      }
      if (
        d.organizer_website.trim() &&
        !/^https?:\/\//i.test(d.organizer_website.trim())
      ) {
        return 'Website should start with http:// or https://'
      }
      return null
    },
  },
  {
    key: 'review',
    label: 'Review',
    validate: () => null,
  },
]

export default function EventCreationWizard({
  onSubmit,
  mode,
  onSuccess,
  initialStepKey,
  subtitle,
  heading,
  submitLabel,
  errorTitle,
  resetControl,
}: Props) {
  const { draft, patch, addTag, removeTag, reset, clearPersisted, hydrated, lastSavedAt } =
    useEventDraft()
  const [stepIndex, setStepIndex] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const activeSteps = useMemo(
    () =>
      STEPS.filter(
        (step) =>
          !step.skip?.(draft) &&
          // Tickets need an events row owned by the submitter — community
          // submissions have neither until an admin approves them.
          !(step.key === 'tickets' && mode === 'community'),
      ),
    [draft, mode],
  )

  // Farthest step the draft's current data justifies jumping to: everything
  // before it validates. Lets people who already filled the form (editing, or
  // coming back to a complete draft) hop between steps freely.
  const firstInvalidIndex = useMemo(
    () => activeSteps.findIndex((s) => s.validate(draft) !== null),
    [activeSteps, draft],
  )
  const maxJumpIndex =
    firstInvalidIndex === -1 ? activeSteps.length - 1 : firstInvalidIndex

  const initialStepAppliedRef = useRef(false)
  useEffect(() => {
    if (initialStepAppliedRef.current) return
    if (!hydrated) return
    initialStepAppliedRef.current = true
    if (!initialStepKey) return
    const idx = activeSteps.findIndex((s) => s.key === initialStepKey)
    if (idx < 0) return
    // Never jump past a step the draft doesn't satisfy yet — otherwise an
    // incomplete draft could reach Review and submit without validation.
    const firstInvalid = activeSteps.findIndex((s) => s.validate(draft) !== null)
    const target = firstInvalid >= 0 ? Math.min(firstInvalid, idx) : idx
    // One-shot jump once the wizard's persisted draft has finished loading.
    setStepIndex(target)
  }, [hydrated, initialStepKey, activeSteps, draft])

  const activeStep = activeSteps[stepIndex] ?? activeSteps[0]
  const isLast = stepIndex >= activeSteps.length - 1
  const isFirst = stepIndex === 0

  // On mobile a step change can leave the viewport scrolled to where the
  // previous (taller) step ended — snap back to the top of the wizard.
  const prevStepIndexRef = useRef(stepIndex)
  useEffect(() => {
    if (prevStepIndexRef.current === stepIndex) return
    prevStepIndexRef.current = stepIndex
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [stepIndex])

  const jumpToKey = useCallback(
    (key: string) => {
      const idx = activeSteps.findIndex((s) => s.key === key)
      if (idx >= 0) {
        setStepIndex(idx)
        setStepError(null)
      }
    },
    [activeSteps],
  )

  const handleNext = async () => {
    if (submitting) return
    setStepError(null)
    const err = activeStep.validate(draft)
    if (err) {
      setStepError(err)
      return
    }

    if (!isLast) {
      setStepIndex((i) => i + 1)
      return
    }

    // Last step → submit. Re-validate every step first so a draft that went
    // stale (e.g. its date slipped into the past) can never slip through.
    const firstInvalid = activeSteps.findIndex((s) => s.validate(draft) !== null)
    if (firstInvalid >= 0 && firstInvalid < stepIndex) {
      setStepIndex(firstInvalid)
      setStepError(activeSteps[firstInvalid].validate(draft))
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await onSubmit(draft)

      if (result.error) {
        setSubmitError(result.error)
        return
      }

      if (result.id) {
        clearPersisted()
        onSuccess?.(result.id)
      }
    } catch (e) {
      console.error('wizard submit error:', e)
      setSubmitError(
        'Could not reach the server — check your connection and try again. Your draft is safe on this device.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    setStepError(null)
    if (!isFirst) setStepIndex((i) => i - 1)
  }

  const handleReset = () => {
    if (typeof window === 'undefined') return
    if (resetControl) {
      if (!window.confirm(resetControl.confirmText)) return
      resetControl.onReset()
      return
    }
    if (!window.confirm('Discard this draft and start over?')) return
    reset()
    setStepIndex(0)
    setStepError(null)
    setSubmitError(null)
  }

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl scroll-mt-24">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {heading ?? (mode === 'community' ? 'Submit an event' : 'Create event')}
          </h1>
          <p className="mt-1 text-sm text-white/55">
            {subtitle ??
              (mode === 'admin'
                ? 'Publishing as AlbaGo — this event goes live on the public site the moment you submit.'
                : mode === 'organizer'
                  ? 'Goes into your draft list. Submit for review when you are ready.'
                  : 'Your submission goes to the moderation queue. Approved events appear on the public site.')}
          </p>
          {hydrated && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/40">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400/80" />
              Draft autosaved on this device
              {lastSavedAt
                ? ` · ${lastSavedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
        >
          {resetControl?.label ?? 'Reset draft'}
        </button>
      </div>

      <Stepper
        steps={activeSteps}
        activeIndex={stepIndex}
        maxJumpIndex={maxJumpIndex}
        onJump={(i) => { setStepIndex(i); setStepError(null) }}
        draft={draft}
      />

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        {activeStep.key === 'type' && (
          <>
            <EventTypeStep draft={draft} patch={patch} />
            {draft.event_type && draft.event_type !== 'protest' && (
              <div className="mt-8 border-t border-white/[0.08] pt-8">
                <CategoryStep draft={draft} patch={patch} />
              </div>
            )}
          </>
        )}
        {activeStep.key === 'basics' && (
          <BasicsStep draft={draft} patch={patch} addTag={addTag} removeTag={removeTag} />
        )}
        {activeStep.key === 'when' && <WhenStep draft={draft} patch={patch} />}
        {activeStep.key === 'where' && <WhereStep draft={draft} patch={patch} />}
        {activeStep.key === 'media' && <MediaStep draft={draft} patch={patch} />}
        {activeStep.key === 'tickets' && <TicketsStep draft={draft} patch={patch} />}
        {activeStep.key === 'organizer' && (
          <OrganizerStep draft={draft} patch={patch} mode={mode} />
        )}
        {activeStep.key === 'review' && (
          <ReviewStep draft={draft} onJumpTo={jumpToKey} />
        )}
      </div>

      {stepError && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {stepError}
        </div>
      )}

      {submitError && (
        <SubmitErrorModal
          title={errorTitle}
          message={submitError}
          onDismiss={() => setSubmitError(null)}
        />
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirst || submitting}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <p className="text-xs text-white/45">
          Step {stepIndex + 1} of {activeSteps.length}
        </p>

        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Submitting…
            </>
          ) : isLast ? (
            <>
              <Check className="h-3.5 w-3.5" />
              {submitLabel ?? 'Submit'}
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function Stepper(props: {
  steps: StepDef[]
  activeIndex: number
  /** Farthest index reachable by direct jump (every step before it passes). */
  maxJumpIndex: number
  onJump: (i: number) => void
  draft: EventDraft
}) {
  const { steps, activeIndex, maxJumpIndex, onJump, draft } = props

  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, idx) => {
        const isActive = idx === activeIndex
        const isPast = idx < activeIndex
        const reachable = idx <= activeIndex || idx <= maxJumpIndex
        const passes = step.validate(draft) === null
        return (
          <li key={step.key}>
            <button
              type="button"
              onClick={() => {
                if (reachable) onJump(idx)
              }}
              disabled={!reachable}
              className={[
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                isActive
                  ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
                  : isPast
                    ? 'border-white/15 bg-white/[0.06] text-white/85 hover:bg-white/[0.10]'
                    : reachable
                      ? 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
                      : 'border-white/10 bg-transparent text-white/40',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                  isActive
                    ? 'bg-flame-500 text-white'
                    : isPast && passes
                      ? 'bg-emerald-500/80 text-white'
                      : 'bg-white/10 text-white/55',
                ].join(' ')}
              >
                {isPast && passes ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              {step.label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
