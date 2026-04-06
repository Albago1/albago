import maplibregl from 'maplibre-gl'
import type {
  CreateMapAdapterParams,
  FlyToPlaceInput,
  MapAdapter,
  MapMarkerInput,
} from './map.types'

const TIRANA_CENTER: [number, number] = [19.8187, 41.3275]
const MAPLIBRE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export function createMaplibreAdapter({
  container,
  onMapClick,
  getMarkerClassName,
}: CreateMapAdapterParams): MapAdapter {
  const map = new maplibregl.Map({
    container,
    style: MAPLIBRE_STYLE_URL,
    center: TIRANA_CENTER,
    zoom: 12.5,
  })

  const markers: maplibregl.Marker[] = []

  map.on('load', () => {
    console.log('MapLibre map loaded successfully')
  })

  map.on('error', event => {
    console.error('MapLibre error:', event)
  })

  map.on('click', onMapClick)

  const clearMarkers = () => {
    markers.forEach(marker => marker.remove())
    markers.length = 0
  }

  const createMarkerElement = (marker: MapMarkerInput) => {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = getMarkerClassName(marker.isSelected)
    element.textContent = marker.name

    element.addEventListener('click', event => {
      event.stopPropagation()
      marker.onClick()
    })

    return element
  }

  return {
    setMarkers(markerInputs) {
      clearMarkers()

      markerInputs.forEach(markerInput => {
        const element = createMarkerElement(markerInput)

        const marker = new maplibregl.Marker({
          element,
          anchor: 'bottom',
        })
          .setLngLat([markerInput.lng, markerInput.lat])
          .addTo(map)

        markers.push(marker)
      })
    },

    flyToPlace({ lng, lat, isMobile }: FlyToPlaceInput) {
      map.flyTo({
        center: [lng, lat],
        zoom: 13.4,
        padding: isMobile
          ? { top: 90, bottom: 320, left: 24, right: 24 }
          : { top: 40, bottom: 40, left: 40, right: 420 },
        essential: true,
      })
    },

    destroy() {
      clearMarkers()
      map.remove()
    },
  }
}