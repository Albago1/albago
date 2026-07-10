export type MapMarkerInput = {
  id: string
  name: string
  lat: number
  lng: number
  isSelected: boolean
  /** Drives the pin color: events burn flame, venues are ink. */
  kind?: 'event' | 'venue'
  eventCount?: number
  hasHighlight?: boolean
  category?: string
  onClick: () => void
}

export type FlyToPlaceInput = {
  lng: number
  lat: number
  isMobile: boolean
}

export type CreateMapAdapterParams = {
  container: HTMLDivElement
  center: [number, number]
  zoom: number
  onMapClick: () => void
  /** Fires whenever the geolocate control gets a position fix. */
  onGeolocate?: (center: [number, number]) => void
}

export type FitBoundsOptions = {
  padding?: number
  maxZoom?: number
  duration?: number
}

export type FlyPadding = {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export type MapAdapter = {
  setMarkers: (markers: MapMarkerInput[]) => void
  flyToPlace: (input: FlyToPlaceInput) => void
  flyToLocation: (center: [number, number], zoom: number, padding?: FlyPadding) => void
  fitBounds: (coords: Array<[number, number]>, options?: FitBoundsOptions) => void
  getZoom: () => number
  /** Fly to the visitor's position (Google-style blue dot + tracking). */
  locateUser: () => void
  destroy: () => void
}