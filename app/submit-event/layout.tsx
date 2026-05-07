import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Submit an Event',
  description: 'Submit your event to AlbaGo and reach thousands of nightlife explorers.',
}

export default function SubmitEventLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
