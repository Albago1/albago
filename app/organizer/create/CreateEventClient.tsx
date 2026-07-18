'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Pencil, RotateCcw } from 'lucide-react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import type { StepKey } from '@/components/event-wizard/EventCreationWizard'
import { createClient } from '@/lib/supabase/browser'
import { submitOrganizerEvent } from '@/lib/events-organizer'
import { submitOrganizerDraft, updateOrganizerDraft } from '@/lib/wizardSubmit'
import { defaultEventDraft, type EventDraft } from '@/types/eventDraft'
import type { VerificationTier } from '@/types/organizer'

const DRAFT_STORAGE_KEY = 'albago:event-draft:v1'
// Which existing event the persisted draft belongs to. Kept in localStorage
// alongside the draft so a refresh (or a later visit) resumes edit mode
// instead of silently creating a duplicate event from the same content.
const EDIT_TARGET_KEY = 'albago:event-edit-target:v1'

type Phase = 'ready' | 'seeding' | 'error'

type EditTarget = { id: string; title: string }

function isDraftMeaningful(raw: string | null): boolean {
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as Partial<EventDraft>
    return Boolean(parsed.title?.trim() || parsed.description?.trim())
  } catch {
    return false
  }
}

function readEditTarget(): EditTarget | null {
  try {
    const raw = window.localStorage.getItem(EDIT_TARGET_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EditTarget>
    if (typeof parsed.id !== 'string' || !parsed.id) return null
    return { id: parsed.id, title: parsed.title || 'Untitled event' }
  } catch {
    return null
  }
}

function writeEditTarget(target: EditTarget) {
  try {
    window.localStorage.setItem(EDIT_TARGET_KEY, JSON.stringify(target))
  } catch {
    /* quota or disabled — ignore */
  }
}

function clearEditTarget() {
  try {
    window.localStorage.removeItem(EDIT_TARGET_KEY)
  } catch {
    /* ignore */
  }
}

function eventRowToDraft(
  row: Record<string, unknown>,
  opts?: { keepSchedule?: boolean },
): EventDraft {
  const socials = (row.organizer_socials as EventDraft['organizer_socials']) ?? {}
  const expected = row.expected_attendees
  const gallery = Array.isArray(row.gallery_urls) ? (row.gallery_urls as string[]) : []
  return {
    ...defaultEventDraft,
    event_type: row.is_civic ? 'protest' : 'event',
    is_civic: Boolean(row.is_civic),
    is_online: Boolean(row.is_online),
    category: (row.category as string) ?? '',
    title: (row.title as string) ?? '',
    description: (row.description as string) ?? '',
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    language: (row.language as string) ?? 'en',
    // Repost clears the schedule so the organizer must enter fresh dates;
    // editing keeps it — the whole point is amending the existing listing.
    date: opts?.keepSchedule ? ((row.date as string) ?? '') : '',
    time: opts?.keepSchedule ? ((row.time as string) ?? '') : '',
    end_time: opts?.keepSchedule ? ((row.end_time as string) ?? '') : '',
    timezone: (row.timezone as string) ?? defaultEventDraft.timezone,
    location_slug: (row.location_slug as string) ?? '',
    country: (row.country as string) ?? '',
    region: (row.region as string) ?? '',
    city: (row.city as string) ?? '',
    address: (row.address as string) ?? '',
    address_hint: (row.address_hint as string) ?? '',
    venue_name: (row.venue_name as string) ?? '',
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    online_url: (row.online_url as string) ?? '',
    gallery_urls: gallery.length
      ? gallery
      : row.banner_url
        ? [row.banner_url as string]
        : [],
    organizer_name: (row.organizer_name as string) ?? '',
    organizer_contact: (row.organizer_contact as string) ?? '',
    organizer_phone: (row.organizer_phone as string) ?? '',
    organizer_website: (row.organizer_website as string) ?? '',
    organizer_socials: socials,
    price: (row.price as string) ?? '',
    featured_movement_slug: (row.featured_movement_slug as string) ?? '',
    telegram_link: (row.telegram_link as string) ?? '',
    whatsapp_link: (row.whatsapp_link as string) ?? '',
    safety_notes: (row.safety_notes as string) ?? '',
    expected_attendees: expected != null ? String(expected) : '',
    recurrence: ((row.recurrence as EventDraft['recurrence']) ?? 'none'),
    recurrence_until: (row.recurrence_until as string) ?? '',
    recurrence_days_of_week: Array.isArray(row.recurrence_days_of_week)
      ? (row.recurrence_days_of_week as number[])
      : [],
    recurrence_exceptions: Array.isArray(row.recurrence_exceptions)
      ? (row.recurrence_exceptions as string[])
      : [],
  }
}

// What actually happened to the created/updated event, so the success screen
// tells the truth: verified/established tiers publish instantly inside the
// RPC; unverified drafts are auto-submitted to the admin queue right after
// ('draft' only remains if that call fails).
type CreatedOutcome = 'live' | 'review' | 'draft'

export default function CreateEventClient({
  verificationTier,
}: {
  verificationTier: VerificationTier
}) {
  const router = useRouter()
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [createdOutcome, setCreatedOutcome] = useState<CreatedOutcome>('draft')
  const [wasEditing, setWasEditing] = useState(false)
  const [phase, setPhase] = useState<Phase>('ready')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reposted, setReposted] = useState(false)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  // Bumping the key remounts the wizard so it re-hydrates from localStorage
  // (used when "Discard changes" restores the saved event).
  const [wizardKey, setWizardKey] = useState(0)
  const seededRef = useRef(false)

  useEffect(() => {
    if (seededRef.current) return
    if (typeof window === 'undefined') return
    seededRef.current = true

    const params = new URLSearchParams(window.location.search)
    const repostId = params.get('repost')
    const editId = params.get('draft')

    if (!repostId && !editId) {
      // No deep link. If an edit session is still stored, the persisted draft
      // IS that event's content — resume edit mode so submitting updates the
      // event instead of creating a duplicate.
      const stored = readEditTarget()
      if (stored && isDraftMeaningful(window.localStorage.getItem(DRAFT_STORAGE_KEY))) {
        // One-shot post-mount sync from localStorage (same pattern as the
        // draft hook's hydration).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEditing(stored)
      } else if (stored) {
        clearEditTarget()
      }
      return
    }

    void (async () => {
      setPhase('seeding')

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/sign-in?next=/organizer/create')
        return
      }

      if (editId) {
        const existing = window.localStorage.getItem(DRAFT_STORAGE_KEY)
        const storedTarget = readEditTarget()

        // Already editing this exact event on this device → resume the
        // in-progress edits rather than clobbering them with a re-seed.
        if (storedTarget?.id === editId && isDraftMeaningful(existing)) {
          setEditing(storedTarget)
          router.replace('/organizer/create')
          setPhase('ready')
          return
        }

        if (
          isDraftMeaningful(existing) &&
          !window.confirm(
            'You have an unfinished draft. Replace it with the event you want to edit?',
          )
        ) {
          router.replace('/organizer/create')
          setPhase('ready')
          return
        }

        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', editId)
          .eq('organizer_id', user.id)
          .in('status', ['draft', 'rejected'])
          .maybeSingle()

        if (error || !data) {
          setErrorMessage(
            "That event couldn't be loaded for editing. It may already be in review or published.",
          )
          setPhase('error')
          return
        }

        const seeded = eventRowToDraft(data as Record<string, unknown>, {
          keepSchedule: true,
        })
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(seeded))
        const target: EditTarget = {
          id: editId,
          title: ((data as Record<string, unknown>).title as string) || 'Untitled event',
        }
        writeEditTarget(target)
        setEditing(target)
        router.replace('/organizer/create')
        setPhase('ready')
        return
      }

      // repost
      const existing = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      if (isDraftMeaningful(existing)) {
        const ok = window.confirm(
          'You have an unfinished draft. Replace it with the event you want to repost?',
        )
        if (!ok) {
          router.replace('/organizer/create')
          setPhase('ready')
          return
        }
      }

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', repostId as string)
        .eq('organizer_id', user.id)
        .maybeSingle()

      if (error || !data) {
        setErrorMessage("That event couldn't be loaded for reposting.")
        setPhase('error')
        return
      }

      const seeded = eventRowToDraft(data as Record<string, unknown>)
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(seeded))
      // A repost is a brand-new event — make sure no stale edit session can
      // reroute the submit into an update.
      clearEditTarget()
      setEditing(null)
      router.replace('/organizer/create')
      setReposted(true)
      setPhase('ready')
    })()
  }, [router])

  const handleSubmit = async (draft: EventDraft) => {
    const supabase = createClient()

    if (editing) {
      const result = await updateOrganizerDraft(supabase, editing.id, draft)
      if (result.error || !result.id) return result

      clearEditTarget()
      setWasEditing(true)
      if (verificationTier === 'unverified') {
        // Same as create: send the updated draft straight back to the admin
        // queue so there's no second manual "submit for review" step.
        const { error } = await submitOrganizerEvent(supabase, result.id)
        setCreatedOutcome(error ? 'draft' : 'review')
      } else {
        setCreatedOutcome('live')
      }
      return result
    }

    const result = await submitOrganizerDraft(supabase, draft)
    if (result.error || !result.id) return result

    if (verificationTier === 'unverified') {
      // Send the fresh draft straight to the admin queue so unverified
      // organizers don't need a second manual "submit for review" step.
      const { error } = await submitOrganizerEvent(supabase, result.id)
      setCreatedOutcome(error ? 'draft' : 'review')
    } else {
      setCreatedOutcome('live')
    }
    return result
  }

  const cancelEditing = () => {
    if (
      !window.confirm(
        'Stop editing this event? Unsaved changes on this device will be discarded.',
      )
    ) {
      return
    }
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    clearEditTarget()
    router.push('/organizer')
  }

  // "Discard changes" inside the wizard: re-fetch the saved event and re-seed
  // the draft from it, then remount the wizard so it re-hydrates.
  const discardEdits = () => {
    const target = editing
    if (!target) return
    void (async () => {
      setPhase('seeding')
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/sign-in?next=/organizer/create')
        return
      }
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', target.id)
        .eq('organizer_id', user.id)
        .in('status', ['draft', 'rejected'])
        .maybeSingle()
      if (error || !data) {
        setErrorMessage(
          "The saved event couldn't be reloaded. Your edits are still on this device.",
        )
        setPhase('error')
        return
      }
      const seeded = eventRowToDraft(data as Record<string, unknown>, {
        keepSchedule: true,
      })
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(seeded))
      setWizardKey((k) => k + 1)
      setPhase('ready')
    })()
  }

  if (createdId) {
    const heading = wasEditing
      ? createdOutcome === 'live'
        ? 'Your changes are live'
        : createdOutcome === 'review'
          ? 'Changes sent for review'
          : 'Draft updated'
      : createdOutcome === 'live'
        ? 'Your event is live'
        : createdOutcome === 'review'
          ? 'Sent for review'
          : 'Draft saved'
    const body = wasEditing
      ? createdOutcome === 'live'
        ? 'The updated event was published right away and is now visible to everyone.'
        : createdOutcome === 'review'
          ? 'Your updated event goes back to our team for a quick re-check — it will appear on the site as soon as an admin approves it.'
          : "Your changes are saved to your drafts. Submit the event for moderation when you're ready."
      : createdOutcome === 'live'
        ? 'It was published right away and is now visible to everyone.'
        : createdOutcome === 'review'
          ? 'Our team will confirm it shortly — it goes live as soon as an admin approves it.'
          : "Your event is in your drafts. Review it, then submit it for moderation when you're ready."
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-4 text-2xl font-bold text-white">{heading}</h2>
          <p className="mt-2 text-sm text-emerald-100/80">{body}</p>
          <p className="mt-3 text-xs text-white/45">
            Event id: <span className="font-mono">{createdId}</span>
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/organizer"
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
            >
              Go to dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreatedId(null)
                setWasEditing(false)
                setEditing(null)
                setReposted(false)
                router.refresh()
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'seeding') {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-flame-400" />
        <p className="mt-4 text-sm font-medium text-white/80">
          Loading your event…
        </p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/30 bg-red-500/[0.07] p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-300" />
        <h2 className="mt-4 text-xl font-bold text-white">Couldn&apos;t load that event</h2>
        <p className="mt-2 text-sm text-red-100/80">
          {errorMessage ?? 'Something went wrong.'}
        </p>
        <Link
          href="/organizer"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
        >
          Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <>
      {editing ? (
        <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-flame-500/25 bg-flame-500/[0.07] px-5 py-4 text-sm text-flame-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 font-semibold text-flame-200">
                <Pencil className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Editing “{editing.title}”</span>
              </span>
              <p className="mt-1 text-flame-100/75">
                You&apos;re updating the existing event — saving won&apos;t create a
                duplicate.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEditing}
              className="flex-shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.10] hover:text-white"
            >
              Cancel editing
            </button>
          </div>
        </div>
      ) : reposted ? (
        <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-flame-500/25 bg-flame-500/[0.07] px-5 py-3 text-sm text-flame-100">
          <span className="inline-flex items-center gap-2 font-semibold text-flame-200">
            <RotateCcw className="h-4 w-4" />
            Reposting an earlier event
          </span>
          <span className="ml-2 text-flame-100/80">
            Everything is filled in — just pick the new date and time.
          </span>
        </div>
      ) : null}
      <EventCreationWizard
        key={wizardKey}
        mode="organizer"
        heading={editing ? 'Edit event' : undefined}
        subtitle={
          editing
            ? verificationTier === 'unverified'
              ? 'Your updated event goes back to our team for a quick re-check before it appears on the site.'
              : 'Editing as a trusted organizer — your changes go live the moment you save.'
            : verificationTier === 'unverified'
              ? 'Your event goes to our team for confirmation and appears on the site once approved.'
              : 'Publishing as a trusted organizer — your event goes live the moment you submit.'
        }
        submitLabel={editing ? 'Save changes' : undefined}
        errorTitle={editing ? "Couldn't save your changes" : undefined}
        resetControl={
          editing
            ? {
                label: 'Discard changes',
                confirmText: 'Discard your edits and restore the saved event?',
                onReset: discardEdits,
              }
            : undefined
        }
        onSubmit={handleSubmit}
        onSuccess={(id) => setCreatedId(id)}
        initialStepKey={
          editing ? ('review' as StepKey) : reposted ? ('when' as StepKey) : undefined
        }
      />
    </>
  )
}
