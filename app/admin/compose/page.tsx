import type { Metadata } from 'next'
import ComposeClient from './ComposeClient'

export const metadata: Metadata = {
  title: 'Admin · Compose',
}

// Auth + admin role are enforced by app/admin/layout.tsx.
export default function AdminComposePage() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <ComposeClient />
    </div>
  )
}
