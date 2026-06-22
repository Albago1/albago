import type { Metadata } from 'next'
import TermsClient from './TermsClient'

export const metadata: Metadata = {
  title: 'Terms of Service — AlbaGo',
  description:
    'The rules for using AlbaGo: account responsibilities, what you can post, how moderation works, and who is liable for what.',
  openGraph: {
    title: 'Terms of Service — AlbaGo',
    description:
      'Plain-English terms covering account use, submitted content, civic events, and platform liability.',
    type: 'website',
  },
}

export default function TermsPage() {
  return <TermsClient />
}
