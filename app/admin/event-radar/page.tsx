import type { Metadata } from 'next'
import { listCandidates } from '@/lib/radar/service'
import EventRadarClient from './EventRadarClient'

export const metadata: Metadata = {
  title: 'Admin · Event Radar',
}

// Auth + admin role are enforced by app/admin/layout.tsx. Candidates are read
// with the service-role client inside listCandidates (RLS-bypassing, but only
// ever reachable behind the admin guard).
export const dynamic = 'force-dynamic'

export default async function EventRadarPage() {
  const candidates = await listCandidates(200)
  return (
    <div className="px-4 py-6 sm:px-6">
      <EventRadarClient initialCandidates={candidates} />
    </div>
  )
}
