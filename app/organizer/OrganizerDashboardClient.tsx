'use client'

import Link from 'next/link'
import {
  Building2,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import type { Organizer } from '@/types/organizer'
import type { OrganizerEvent, EventStatus } from '@/types/event'

function statusLabel(status: EventStatus): string {
  switch (status) {
    case 'draft': return 'Draft'
    case 'pending_review': return 'Pending review'
    case 'published': return 'Published'
    case 'rejected': return 'Rejected'
    case 'cancelled': return 'Cancelled'
    case 'completed': return 'Completed'
  }
}

function statusStyle(status: EventStatus): string {
  switch (status) {
    case 'draft': return 'border-white/15 bg-white/[0.05] text-white/60'
    case 'pending_review': return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    case 'published': return 'border-blue-500/20 bg-blue-500/10 text-blue-400'
    case 'rejected': return 'border-red-500/20 bg-red-500/10 text-red-400'
    case 'cancelled': return 'border-white/10 bg-white/[0.03] text-white/40'
    case 'completed': return 'border-green-500/20 bg-green-500/10 text-green-400'
  }
}

export default function OrganizerDashboardClient({
  organizer,
  events,
}: {
  organizer: Organizer
  events: OrganizerEvent[]
}) {
  const counts = {
    draft: events.filter((e) => e.status === 'draft').length,
    pending_review: events.filter((e) => e.status === 'pending_review').length,
    published: events.filter((e) => e.status === 'published').length,
    rejected: events.filter((e) => e.status === 'rejected').length,
  }

  const statusCounts = [
    {
      label: 'Drafts',
      value: counts.draft,
      icon: FileText,
      active: counts.draft > 0,
      color: 'text-white/70',
      activeColor: 'text-white',
      bg: 'bg-white/[0.03] border-white/10',
    },
    {
      label: 'Pending review',
      value: counts.pending_review,
      icon: Clock,
      active: counts.pending_review > 0,
      color: 'text-white/70',
      activeColor: 'text-amber-400',
      bg: 'bg-white/[0.03] border-white/10',
      activeBg: 'bg-amber-500/[0.07] border-amber-500/15',
    },
    {
      label: 'Published',
      value: counts.published,
      icon: CheckCircle2,
      active: counts.published > 0,
      color: 'text-white/70',
      activeColor: 'text-blue-400',
      bg: 'bg-white/[0.03] border-white/10',
      activeBg: 'bg-blue-500/[0.07] border-blue-500/15',
    },
    {
      label: 'Rejected',
      value: counts.rejected,
      icon: XCircle,
      active: counts.rejected > 0,
      color: 'text-white/70',
      activeColor: 'text-red-400',
      bg: 'bg-white/[0.03] border-white/10',
      activeBg: 'bg-red-500/[0.07] border-red-500/15',
    },
  ]

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-[#070b14] px-6 pb-12 pt-24 text-white">
        <div className="mx-auto max-w-3xl">

          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Building2 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {organizer.display_name}
                </h1>
                <p className="mt-0.5 text-sm text-white/45">
                  {organizer.contact_email}
                </p>
              </div>
            </div>

            <Link
              href="/organizer/create"
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create event</span>
            </Link>
          </div>

          {/* Status counts */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statusCounts.map(({ label, value, icon: Icon, active, color, activeColor, bg, activeBg }) => (
              <div
                key={label}
                className={`rounded-3xl border p-5 ${active && activeBg ? activeBg : bg}`}
              >
                <Icon className={`h-5 w-5 ${active ? activeColor : color}`} />
                <div className={`mt-3 text-3xl font-bold ${active ? activeColor : color}`}>
                  {value}
                </div>
                <div className="mt-1 text-xs text-white/45">{label}</div>
              </div>
            ))}
          </div>

          {/* Events list */}
          <div className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              My events
            </h2>

            {events.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <Calendar className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-4 font-semibold text-white">No events yet</p>
                <p className="mt-1 text-sm text-white/50">
                  Create your first event and submit it for review.
                </p>
                <Link
                  href="/organizer/create"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  Create event
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {event.title}
                        </p>
                        <p className="mt-1 text-sm text-white/50">
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {event.time ? ` · ${event.time}` : ''}
                          {' · '}
                          <span className="capitalize">{event.category}</span>
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(event.status)}`}
                      >
                        {statusLabel(event.status)}
                      </span>
                    </div>

                    {event.status === 'rejected' && event.admin_note && (
                      <div className="mt-3 rounded-2xl border border-red-500/15 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                        <span className="font-semibold">Feedback: </span>
                        {event.admin_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  )
}
