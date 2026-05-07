import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Events',
  description: 'Browse all upcoming events in Albania and the Balkans. Filter by city, time, and category.',
}

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
