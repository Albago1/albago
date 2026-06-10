import type { Metadata } from 'next'
import PrivacyClient from './PrivacyClient'

export const metadata: Metadata = {
  title: 'Privacy — AlbaGo',
  description:
    'How AlbaGo handles your data: what we collect, what we share, and how to reach us.',
  openGraph: {
    title: 'Privacy — AlbaGo',
    description:
      'Plain-English data handling: what we collect, where it goes, and how to reach us.',
    type: 'website',
  },
}

export default function PrivacyPage() {
  return <PrivacyClient />
}
