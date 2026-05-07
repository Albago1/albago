import { Suspense } from 'react'
import MapView from '@/components/map/MapView'

export default function MapPage() {
  return (
    <Suspense>
      <MapView />
    </Suspense>
  )
}