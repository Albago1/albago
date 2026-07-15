import type { Metadata } from 'next'
import BroadcastClient from './BroadcastClient'

export const metadata: Metadata = {
  title: 'Admin · Broadcast',
}

// Auth + admin role are enforced by app/admin/layout.tsx.
export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const params = await searchParams
  return (
    <div className="px-4 py-6 sm:px-6">
      <BroadcastClient
        connected={params.connected ?? null}
        connectError={params.error ?? null}
      />
    </div>
  )
}
