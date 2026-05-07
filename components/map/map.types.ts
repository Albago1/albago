export type MapMarkerInput = {
  id: string
  name: string
  lat: number
  lng: number
  isSelected: boolean
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
  getMarkerClassName: (isSelected: boolean) => string
}

export type MapAdapter = {
  setMarkers: (markers: MapMarkerInput[]) => void
  flyToPlace: (input: FlyToPlaceInput) => void
  flyToLocation: (center: [number, number], zoom: number) => void
  destroy: () => void
}