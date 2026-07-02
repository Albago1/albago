import type { Metadata } from 'next'
import { Suspense } from 'react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import SubmitEventClient from './SubmitEventClient'

export const metadata: Metadata = {
  title: 'Submit an event · AlbaGo',
  description:
    'Submit an event to AlbaGo — nightlife, music, culture, food, sports, or a civic gathering. Our team reviews submissions before they go live.',
}

export default function SubmitEventPage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-12 pt-24 text-white">
        <Suspense>
          <SubmitEventClient />
        </Suspense>
      </main>
    </>
  )
}
