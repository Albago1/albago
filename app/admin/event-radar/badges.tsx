import type { CandidateStatus } from '@/lib/radar/candidate'
import type { RadarConfidence } from '@/lib/radar/assess'

/**
 * Event Radar shared status/confidence chips. Kept deliberately plain so the
 * three lifecycle states an admin must never confuse — an extracted draft
 * (needs_review), an approved candidate, and a rejected/failed one — read
 * unmistakably at a glance (spec §10).
 */

const STATUS_META: Record<CandidateStatus, { label: string; className: string }> = {
  processing: { label: 'Processing', className: 'bg-white/[0.06] text-white/60 ring-white/15' },
  needs_review: { label: 'Needs review', className: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  approved: { label: 'Approved · queued', className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/12 text-red-300 ring-red-500/25' },
  failed: { label: 'Unreadable', className: 'bg-flame-500/12 text-flame-300 ring-flame-500/25' },
}

export function StatusBadge({ status }: { status: CandidateStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.needs_review
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

const CONFIDENCE_META: Record<RadarConfidence, { label: string; className: string }> = {
  high: { label: 'High confidence', className: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/25' },
  medium: { label: 'Medium confidence', className: 'bg-amber-500/12 text-amber-300 ring-amber-500/25' },
  low: { label: 'Low confidence', className: 'bg-red-500/12 text-red-300 ring-red-500/25' },
}

export function ConfidenceBadge({ confidence }: { confidence: RadarConfidence | null }) {
  if (!confidence) return null
  const meta = CONFIDENCE_META[confidence]
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}
