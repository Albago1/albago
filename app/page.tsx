import type { Metadata } from 'next'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: 'AlbaGo — Discover Events, Movements & Nightlife',
  description:
    'Discover events, nightlife and civic gatherings across Albania and the Albanian diaspora. Search any city — Tirana, Prishtina, Berlin, New York, London — and join what matters tonight.',
  openGraph: {
    title: 'AlbaGo — Discover Events, Movements & Nightlife',
    description:
      'Discover events, nightlife and civic gatherings across Albania and the Albanian diaspora. Starting in Albania and Albanian communities worldwide, with more cities coming next.',
    siteName: 'AlbaGo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AlbaGo — Events, Movements & Nightlife',
    description:
      'Discover events, nightlife and civic gatherings across Albania and the Albanian diaspora.',
  },
}

export default function HomePage() {
  return <HomeClient />
}
