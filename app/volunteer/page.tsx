import type { Metadata } from 'next'
import VolunteerClient from './VolunteerClient'

export const metadata: Metadata = {
  title: 'Volunteer — AlbaGo',
  description:
    'Join a peaceful civic movement. A few hours of your time can help organize a square, translate a letter, or keep a gathering safe.',
  openGraph: {
    title: 'Volunteer — AlbaGo',
    description:
      'Volunteer with peaceful civic gatherings coordinated through AlbaGo.',
    type: 'website',
  },
}

type SearchParams = Promise<{ movement?: string }>

export default async function VolunteerPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const movementSlug = params?.movement ?? 'albanian-revolution'
  return <VolunteerClient movementSlug={movementSlug} />
}
