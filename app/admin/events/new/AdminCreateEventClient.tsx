'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, CheckCircle2, ExternalLink, Plus, ScanLine } from 'lucide-react'
import EventCreationWizard from '@/components/event-wizard/EventCreationWizard'
import { createClient } from '@/lib/supabase/browser'
import { submitAdminEvent } from '@/lib/wizardSubmit'
import type { EventDraft } from '@/types/eventDraft'

export default function AdminCreateEventClient() {
  const router = useRouter()
  const [published, setPublished] = useState<{ id: string; slug: string } | null>(null)

  const handleSubmit = async (draft: EventDraft) => {
    const supabase = createClient()
    const result = await submitAdminEvent(supabase, draft)
    if (result.id === null) return { id: null, error: result.error }
    setPublished({ id: result.id, slug: result.slug })
    return { id: result.id, error: null }
  }

  if (published) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-4 text-2xl font-bold text-white">Event is live</h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            Published straight to the public site — no moderation step needed.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/events/${published.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
            >
              <ExternalLink className="h-4 w-4" />
              View live page
            </Link>
            <button
              type="button"
              onClick={() => {
                setPublished(null)
                router.refresh()
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Create another
            </button>
            <Link
              href="/admin/events"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
            >
              Back to events
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Scan shortcut — start from a poster photo instead of typing every
          field. The Lens reads it, then drops you back here with the draft
          prefilled. Admin-only surface, so no extra gating needed. */}
      <Link
        href="/scan"
        className="group mb-6 flex items-center gap-4 rounded-2xl border border-flame-500/25 bg-flame-500/[0.06] px-5 py-4 transition hover:border-flame-500/45 hover:bg-flame-500/[0.10]"
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-flame-500/15 text-flame-300">
          <ScanLine className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">
            Have a poster? Scan it
          </span>
          <span className="block text-[13px] text-white/55">
            AlbaGo reads the poster and fills in the event for you — review and publish.
          </span>
        </span>
        <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white/85" />
      </Link>

      <EventCreationWizard mode="admin" onSubmit={handleSubmit} />
    </div>
  )
}
