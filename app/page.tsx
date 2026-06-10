import type { Metadata } from 'next'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: 'AlbaGo — Discover Events, Movements & Nightlife',
  description:
    'Find peaceful civic gatherings, nightlife, and local events worldwide. Search any city — Tirana, Prishtina, Berlin, New York, London — and join what matters tonight.',
  openGraph: {
    title: 'AlbaGo — Discover Events, Movements & Nightlife',
    description:
      'A live, worldwide directory of events and peaceful civic gatherings. Coordinated through AlbaGo — premium, mobile-first, instant.',
    siteName: 'AlbaGo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AlbaGo — Events, Movements & Nightlife',
    description:
      'Discover and join peaceful gatherings and local events across cities and continents.',
  },
}

export default function HomePage() {
  return <HomeClient />
}
