import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCandidate } from '@/lib/radar/service'
import CandidateReviewClient from './CandidateReviewClient'

export const metadata: Metadata = {
  title: 'Admin · Event Radar candidate',
}

export const dynamic = 'force-dynamic'

// Admin role guard is handled by app/admin/layout.tsx for every /admin/* route.
export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const candidate = await getCandidate(id)
  if (!candidate) notFound()

  return (
    <div className="px-4 py-6 sm:px-6">
      <CandidateReviewClient candidate={candidate} />
    </div>
  )
}
