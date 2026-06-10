'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import { createClient } from '@/lib/supabase/browser'
import { submitCommunityEvent } from '@/lib/wizardSubmit'
import type { EventDraft } from '@/types/eventDraft'

export default function SubmitEventClient() {
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const handleSubmit = async (draft: EventDraft) => {
    const supabase = createClient()
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

  return (
    <EventCreationWizard
      mode="community"
      onSubmit={handleSubmit}
      onSuccess={(id) => setSubmittedId(id)}
    />
  )
}
