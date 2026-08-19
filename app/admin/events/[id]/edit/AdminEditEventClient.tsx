'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import { createClient } from '@/lib/supabase/browser'
import { updateAdminEvent } from '@/lib/wizardSubmit'
import { applyDraftTiers, eventRowToDraft, fetchDraftTiers } from '@/lib/eventDraftFromRow'
import type { EventDraft } from '@/types/eventDraft'

const DRAFT_STORAGE_KEY = 'albago:event-draft:v1'

type Phase = 'seeding' | 'ready'

/**
 * Admin "Edit event" — the exact same creation wizard, pre-filled from the
 * saved event and wired to a direct admin update. Seeds the wizard's
 * localStorage draft from the row, then mounts the wizard. Saving keeps the
 * event's current status (a published event stays live instantly).
 */
export default function AdminEditEventClient({
  event,
}: {
  event: Record<string, unknown>
}) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('seeding')
  const [wizardKey, setWizardKey] = useState(0)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const seededRef = useRef(false)

  const eventId = event.id as string
  const slug = event.slug as string

  // Seed the wizard draft from the saved event once, on mount. Also pull the
  // event's live free tiers so the Tickets step opens pre-filled.
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    void (async () => {
      const supabase = createClient()
      const seeded = eventRowToDraft(event, { keepSchedule: true })
      applyDraftTiers(seeded, await fetchDraftTiers(supabase, eventId, { keepIds: true }))
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(seeded))
      } catch {
        /* quota or disabled — the wizard falls back to a blank draft */
      }
      setPhase('ready')
    })()
  }, [event, eventId])

  const handleSubmit = async (draft: EventDraft) => {
    const supabase = createClient()
    const result = await updateAdminEvent(supabase, eventId, draft)
    if (result.error || !result.id) return result
    // Clear the shared draft so a later "create new" doesn't inherit this edit.
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setSavedSlug(slug)
    return result
  }

  // "Discard changes" — restore the wizard from the original row and remount.
  const discardEdits = () => {
    const seeded = eventRowToDraft(event, { keepSchedule: true })
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(seeded))
    } catch {
      /* ignore */
    }
    setWizardKey((k) => k + 1)
  }

  if (savedSlug) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-4 text-2xl font-bold text-white">Changes saved</h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            The event was updated. If it was live, the changes are already
            visible to everyone.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/events/${savedSlug}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
            >
              <ExternalLink className="h-4 w-4" />
              View live page
            </Link>
            <button
              type="button"
              onClick={() => {
                router.push('/admin/events')
                router.refresh()
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
            >
              Back to events
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
        <p className="mt-4 text-sm font-medium text-white/80">Loading this event…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <EventCreationWizard
        key={wizardKey}
        mode="admin"
        onSubmit={handleSubmit}
        heading="Edit event"
        subtitle="Update any field and save — the same flow as creating an event."
        submitLabel="Save changes"
        errorTitle="Couldn't save your changes"
        resetControl={{
          label: 'Discard changes',
          confirmText:
            'Discard your changes and reload the event as it is saved now?',
          onReset: discardEdits,
        }}
      />
    </div>
  )
}
