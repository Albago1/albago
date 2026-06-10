'use client'

import { useState } from 'react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import type { EventDraft } from '@/types/eventDraft'

export default function SubmitEventV2Client() {
  const [lastSubmitted, setLastSubmitted] = useState<EventDraft | null>(null)

  const handleSubmit = async (draft: EventDraft) => {
    // Preview-only: do not write to Supabase yet. The wizard is still
    // missing date/time, location, media, organizer, and review steps.
    setLastSubmitted(draft)
    const result: { id: string; error: null } = { id: 'preview-only', error: null }
    return result
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          <p className="font-semibold">Preview mode</p>
          <p className="mt-1 leading-6 text-amber-100/85">
            This is a work-in-progress preview of the multi-step event creation flow
            (Phase D3). Steps 4&ndash;8 (date, location, media, organizer, review) are
            coming next. Submissions here are NOT saved to the database.
          </p>
        </div>
      </div>

      <EventCreationWizard mode="community" onSubmit={handleSubmit} />

      {lastSubmitted && (
        <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 text-sm text-emerald-100">
          <p className="font-semibold">Preview submit fired ✓</p>
          <p className="mt-1 text-emerald-100/85">
            The wizard collected the draft below. In Phase D6 this will be written to
            event_submissions / events depending on the user&apos;s role.
          </p>
          <pre className="mt-4 max-h-96 overflow-auto rounded-2xl border border-emerald-500/20 bg-ink-950/70 p-3 text-[11px] leading-5 text-emerald-100/80">
            {JSON.stringify(lastSubmitted, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
