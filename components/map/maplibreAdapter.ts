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

  // Standard map affordances the best map products all ship: zoom buttons
  // (desktop muscle memory) and a locate-me button that flies to the
  // visitor's position — both bottom-right, clear of our floating UI.
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    'bottom-right',
  )
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: false },
      fitBoundsOptions: { maxZoom: 12.5 },
      showAccuracyCircle: false,
    }),
    'bottom-right',
  )

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
          ? '<span class="h-1.5 w-1.5 rounded-full bg-flame-400 shadow-[0_0_10px_rgba(238,28,37,0.95)]"></span>'
          : '<span class="h-1.5 w-1.5 rounded-full bg-flame-500 shadow-[0_0_10px_rgba(238,28,37,0.6)]"></span>'
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

    flyToLocation(center, zoom, padding) {
      map.flyTo({
        center,
        zoom,
        // Explicit zeros: flyTo padding is sticky on the map instance, so a
        // partial object would inherit stale offsets from the previous fly.
        padding: {
          top: padding?.top ?? 0,
          bottom: padding?.bottom ?? 0,
          left: padding?.left ?? 0,
          right: padding?.right ?? 0,
        },
        essential: true,
      })
    },

    getZoom() {
      return map.getZoom()
    },

    fitBounds(coords, options) {
      if (coords.length === 0) return
      if (coords.length === 1) {
        map.flyTo({ center: coords[0], zoom: 10, essential: true })
        return
      }
      const bounds = new maplibregl.LngLatBounds(coords[0], coords[0])
      for (const c of coords) bounds.extend(c)
      map.fitBounds(bounds, {
        padding: options?.padding ?? 60,
        maxZoom: options?.maxZoom ?? 6,
        duration: options?.duration ?? 800,
        essential: true,
      })
    },

    destroy() {
      clearMarkers()
      map.remove()
    },
  }
}