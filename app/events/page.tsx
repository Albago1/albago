import type { Metadata } from 'next'
import EventsClient from './EventsClient'

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Browse and search live events worldwide — nightlife, music, culture, food, sports, and peaceful civic gatherings. Filter by city, time, and category.',
  openGraph: {
    title: 'Events — AlbaGo',
    description:
      'A live, mobile-first events directory. Find what is happening tonight, this weekend, or in any city, anywhere.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Events — AlbaGo',
    description: 'Discover events worldwide. Search any city.',
  },
}

export default function EventsPage() {
  return <EventsClient />
}
