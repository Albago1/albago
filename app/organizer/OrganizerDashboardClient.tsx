'use client'

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

const STATUS_COUNTS = [
  {
    label: 'Drafts',
    value: 0,
    icon: FileText,
    color: 'text-white/70',
    bg: 'bg-white/[0.03] border-white/10',
  },
  {
    label: 'Pending review',
    value: 0,
    icon: Clock,
    color: 'text-amber-400',
    bg: 'bg-amber-500/[0.07] border-amber-500/15',
  },
  {
    label: 'Published',
    value: 0,
    icon: CheckCircle2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/[0.07] border-blue-500/15',
  },
  {
    label: 'Rejected',
    value: 0,
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/[0.07] border-red-500/15',
  },
]

export default function OrganizerDashboardClient({
  organizer,
}: {
  organizer: Organizer
}) {
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

            <button
              disabled
              title="Event creation coming soon"
              className="inline-flex flex-shrink-0 cursor-not-allowed items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/35"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create event</span>
            </button>
          </div>

          {/* Status counts */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATUS_COUNTS.map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className={`rounded-3xl border p-5 ${bg}`}
              >
                <Icon className={`h-5 w-5 ${color}`} />
                <div className={`mt-3 text-3xl font-bold ${color}`}>
                  {value}
                </div>
                <div className="mt-1 text-xs text-white/45">{label}</div>
              </div>
            ))}
          </div>

          {/* Events section */}
          <div className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              My events
            </h2>

            <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
              <Calendar className="mx-auto h-8 w-8 text-white/20" />
              <p className="mt-4 font-semibold text-white">No events yet</p>
              <p className="mt-1 text-sm text-white/50">
                Event creation is coming soon. Your events will appear here.
              </p>
              <button
                disabled
                className="mt-6 inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white/35"
              >
                <Plus className="h-4 w-4" />
                Create event
              </button>
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
