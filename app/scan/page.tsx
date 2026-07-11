import type { Metadata } from 'next'
import LandingNavbar from '@/components/layout/LandingNavbar'
import ScanClient from './ScanClient'

export const metadata: Metadata = {
  title: 'Scan a poster',
  description:
    'Point your camera at any event poster — AlbaGo reads it and turns it into an event.',
}

export default function ScanPage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-24 pt-24 text-white">
        <ScanClient />
      </main>
    </>
  )
}
