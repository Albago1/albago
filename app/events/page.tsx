import type { Metadata } from 'next'
import EventsClient from './EventsClient'

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Browse and search events across Albania and the Albanian diaspora — nightlife, music, culture, food, sports, and peaceful civic gatherings. Filter by city, time, and category.',
  openGraph: {
    title: 'Events — AlbaGo',
    description:
      'A live, mobile-first events directory for Albania and the Albanian diaspora. Find what is happening tonight, this weekend, or in your city.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Events — AlbaGo',
    description:
      'Discover events across Albania and the Albanian diaspora. Search any city.',
  },
}

export default function EventsPage() {
  return <EventsClient />
}
