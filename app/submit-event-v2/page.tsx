import type { Metadata } from 'next'
import LandingNavbar from '@/components/layout/LandingNavbar'
import SubmitEventV2Client from './SubmitEventV2Client'

export const metadata: Metadata = {
  title: 'Submit an event · AlbaGo',
  description: 'Submit an event to AlbaGo — the multi-step submission flow.',
}

export default function SubmitEventV2Page() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-12 pt-24 text-white">
        <SubmitEventV2Client />
      </main>
    </>
  )
}
