import type { Metadata } from 'next'
import ComposeClient from './ComposeClient'
import { recentTokenTotal } from '@/lib/agent/usage'

export const metadata: Metadata = {
  title: 'Admin · Compose',
}

export const dynamic = 'force-dynamic'

// Auth + admin role are enforced by app/admin/layout.tsx.
export default async function AdminComposePage() {
  // null when the ledger isn't there yet (migration unapplied) — the client
  // then shows nothing rather than a confident, wrong zero.
  const monthTokens = await recentTokenTotal('compose', 30)

  return (
    <div className="px-4 py-6 sm:px-6">
      <ComposeClient monthTokens={monthTokens} />
    </div>
  )
}
