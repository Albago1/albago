import type { Metadata } from 'next'
import AdminCreateEventClient from './AdminCreateEventClient'

export const metadata: Metadata = {
  title: 'Admin · New event',
}

// Auth + admin role are enforced by app/admin/layout.tsx.
//
// `?cid=` marks a draft handed over by Event Radar. Read here on the server and
// passed down, rather than useSearchParams() in the client — this page has no
// Suspense boundary, and a prop needs none.
export default async function AdminNewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ cid?: string }>
}) {
  const { cid } = await searchParams
  return (
    <div className="px-4 py-6 sm:px-6">
      <AdminCreateEventClient candidateId={cid ?? null} />
    </div>
  )
}
