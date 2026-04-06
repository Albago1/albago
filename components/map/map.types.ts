export type MapMarkerInput = {
  id: string
  name: string
  lat: number
  lng: number
  isSelected: boolean
  onClick: () => void
}

export type FlyToPlaceInput = {
  lng: number
  lat: number
  isMobile: boolean
}

export type CreateMapAdapterParams = {
  container: HTMLDivElement
  onMapClick: () => void
  getMarkerClassName: (isSelected: boolean) => string
}

export type MapAdapter = {
  setMarkers: (markers: MapMarkerInput[]) => void
  flyToPlace: (input: FlyToPlaceInput) => void
  destroy: () => void
}