import type { Metadata } from 'next'
import { Suspense } from 'react'
import MapView from '@/components/map/MapView'

export const metadata: Metadata = {
  title: 'Map',
  description: 'Explore nightlife venues and events on the interactive AlbaGo map.',
}

export default function MapPage() {
  return (
    <Suspense>
      <MapView />
    </Suspense>
  )
}