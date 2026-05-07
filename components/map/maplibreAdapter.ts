import maplibregl from 'maplibre-gl'
import type {
  CreateMapAdapterParams,
  FlyToPlaceInput,
  MapAdapter,
  MapMarkerInput,
} from './map.types'

const MAPLIBRE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export function createMaplibreAdapter({
  container,
  center,
  zoom,
  onMapClick,
  getMarkerClassName,
}: CreateMapAdapterParams): MapAdapter {
  const map = new maplibregl.Map({
    container,
    style: MAPLIBRE_STYLE_URL,
    center,
    zoom,
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

  element.innerHTML = `
    <span class="flex items-center gap-1.5">
      ${
        marker.hasHighlight
          ? '<span class="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.9)]"></span>'
          : '<span class="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]"></span>'
      }

      <span class="max-w-[120px] truncate">${marker.name}</span>

      ${
        marker.eventCount && marker.eventCount > 0
          ? `<span class="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">${marker.eventCount}</span>`
          : ''
      }
    </span>
  `

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

    flyToLocation(center, zoom) {
      map.flyTo({ center, zoom, essential: true })
    },

    destroy() {
      clearMarkers()
      map.remove()
    },
  }
}