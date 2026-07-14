import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Events',
  description: 'Browse all upcoming events across Albania and the Albanian diaspora. Filter by city, time, and category.',
}

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
