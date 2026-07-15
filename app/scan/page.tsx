import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { hasStudioAccess } from '@/lib/ai/studioAccess'
import ScanClient from './ScanClient'

export const metadata: Metadata = {
  title: 'Scan a poster',
  description:
    'Point your camera at any event poster — AlbaGo reads it and turns it into an event.',
}

export default async function ScanPage() {
  // Lens is a differentiator we're not ready to expose broadly: admins plus
  // individually granted users (profiles.studio_access) only, for now.
  if (!(await hasStudioAccess())) redirect('/submit-event')

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-24 pt-24 text-white">
        <ScanClient />
      </main>
    </>
  )
}
