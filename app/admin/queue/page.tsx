import type { Metadata } from 'next'
import LandingNavbar from '@/components/layout/LandingNavbar'
import AdminClient from '../AdminClient'

export const metadata: Metadata = {
  title: 'Admin · Moderation queue',
}

// Admin role guard is handled by app/admin/layout.tsx for every /admin/* route.
export default function AdminQueuePage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-6 pt-24 text-white">
        <AdminClient />
      </main>
    </>
  )
}
