'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import type { StepKey } from '@/components/event-wizard/EventCreationWizard'
import { createClient } from '@/lib/supabase/browser'
import { submitOrganizerEvent } from '@/lib/events-organizer'
import { submitOrganizerDraft } from '@/lib/wizardSubmit'
import { defaultEventDraft, type EventDraft } from '@/types/eventDraft'
import type { VerificationTier } from '@/types/organizer'

const DRAFT_STORAGE_KEY = 'albago:event-draft:v1'

type Phase = 'ready' | 'seeding' | 'error'

function isDraftMeaningful(raw: string | null): boolean {
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as Partial<EventDraft>
    return Boolean(parsed.title?.trim() || parsed.description?.trim())
  } catch {
    return false
  }
}

function eventRowToDraft(row: Record<string, unknown>): EventDraft {
  const socials = (row.organizer_socials as EventDraft['organizer_socials']) ?? {}
  const expected = row.expected_attendees
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
    // Cleared so the organizer must enter a fresh schedule.
    date: '',
    time: '',
    end_time: '',
    timezone: (row.timezone as string) ?? defaultEventDraft.timezone,
    location_slug: (row.location_slug as string) ?? '',
    country: (row.country as string) ?? '',
    region: (row.region as string) ?? '',
    city: (row.city as string) ?? '',
    address: (row.address as string) ?? '',
    venue_name: (row.venue_name as string) ?? '',
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    online_url: (row.online_url as string) ?? '',
    gallery_urls: Array.isArray(row.gallery_urls) ? (row.gallery_urls as string[]) : [],
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

// What actually happened to the created event, so the success screen tells
// the truth: verified/established tiers publish instantly inside
// organizer_create_event_v2; unverified drafts are auto-submitted to the
// admin queue right after creation ('draft' only remains if that call fails).
type CreatedOutcome = 'live' | 'review' | 'draft'

export default function CreateEventClient({
  verificationTier,
}: {
  verificationTier: VerificationTier
}) {
  const router = useRouter()
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [createdOutcome, setCreatedOutcome] = useState<CreatedOutcome>('draft')
  const [phase, setPhase] = useState<Phase>('ready')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reposted, setReposted] = useState(false)
  const seededRef = useRef(false)

  useEffect(() => {
    if (seededRef.current) return
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const repostId = params.get('repost')
    if (!repostId) {
      seededRef.current = true
      return
    }
    seededRef.current = true

    void (async () => {
      setPhase('seeding')

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
        .eq('id', repostId)
        .eq('organizer_id', user.id)
        .maybeSingle()

      if (error || !data) {
        setErrorMessage("That event couldn't be loaded for reposting.")
        setPhase('error')
        return
      }

      const seeded = eventRowToDraft(data as Record<string, unknown>)
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(seeded))
      router.replace('/organizer/create')
      setReposted(true)
      setPhase('ready')
    })()
  }, [router])

  const handleSubmit = async (draft: EventDraft) => {
    const supabase = createClient()
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

  if (createdId) {
    const heading =
      createdOutcome === 'live'
        ? 'Your event is live'
        : createdOutcome === 'review'
          ? 'Sent for review'
          : 'Draft saved'
    const body =
      createdOutcome === 'live'
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
          Loading your event so you can repost it…
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
      {reposted && (
        <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-flame-500/25 bg-flame-500/[0.07] px-5 py-3 text-sm text-flame-100">
          <span className="inline-flex items-center gap-2 font-semibold text-flame-200">
            <RotateCcw className="h-4 w-4" />
            Reposting an earlier event
          </span>
          <span className="ml-2 text-flame-100/80">
            Everything is filled in — just pick the new date and time.
          </span>
        </div>
      )}
      <EventCreationWizard
        mode="organizer"
        subtitle={
          verificationTier === 'unverified'
            ? 'Your event goes to our team for confirmation and appears on the site once approved.'
            : 'Publishing as a trusted organizer — your event goes live the moment you submit.'
        }
        onSubmit={handleSubmit}
        onSuccess={(id) => setCreatedId(id)}
        initialStepKey={reposted ? ('when' as StepKey) : undefined}
      />
    </>
  )
}
