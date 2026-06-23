import type { Metadata } from 'next'
import AdminClient from '../AdminClient'

export const metadata: Metadata = {
  title: 'Admin · Moderation queue',
}

// Admin role guard is handled by app/admin/layout.tsx for every /admin/* route.
export default function AdminQueuePage() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <AdminClient />
    </div>
  )
}
