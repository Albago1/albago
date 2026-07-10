import type { Metadata } from 'next'
import AdminCreateEventClient from './AdminCreateEventClient'

export const metadata: Metadata = {
  title: 'Admin · New event',
}

// Auth + admin role are enforced by app/admin/layout.tsx.
export default function AdminNewEventPage() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <AdminCreateEventClient />
    </div>
  )
}
