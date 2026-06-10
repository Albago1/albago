'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import { createClient } from '@/lib/supabase/browser'
import { submitOrganizerDraft } from '@/lib/wizardSubmit'
import type { EventDraft } from '@/types/eventDraft'

export default function CreateEventClient() {
  const router = useRouter()
  const [createdId, setCreatedId] = useState<string | null>(null)

  const handleSubmit = async (draft: EventDraft) => {
    const supabase = createClient()
    return submitOrganizerDraft(supabase, draft)
  }

  if (createdId) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-4 text-2xl font-bold text-white">Draft saved</h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            Your event is in your drafts. Review it, then submit it for
            moderation when you&apos;re ready.
          </p>
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

  return (
    <EventCreationWizard
      mode="organizer"
      onSubmit={handleSubmit}
      onSuccess={(id) => setCreatedId(id)}
    />
  )
}
