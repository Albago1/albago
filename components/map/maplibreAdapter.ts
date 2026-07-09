import maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import type {
  CreateMapAdapterParams,
  FlyToPlaceInput,
  MapAdapter,
  MapMarkerInput,
} from './map.types'

const MAPLIBRE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

// GPU pin layers. Pins used to be DOM markers (one blurred, shadowed button
// element per event) — panning repainted all of them every frame, which is
// exactly the mobile jank the best map products never have. Rendering them
// as clustered GeoJSON layers moves the whole pin system onto the GPU:
// buttery panning, automatic label collision (overlapping titles hide
// instead of stacking), and dense areas collapse into tap-to-zoom counters.
const SOURCE_ID = 'albago-pins'
const LAYER_CLUSTERS = 'albago-clusters'
const LAYER_CLUSTER_COUNT = 'albago-cluster-count'
const LAYER_SELECTED_HALO = 'albago-selected-halo'
const LAYER_POINTS = 'albago-points'
const LAYER_POINT_LABELS = 'albago-point-labels'
const CLICKABLE_LAYERS = [LAYER_POINTS, LAYER_CLUSTERS]

const FLAME = '#EE1C25'
const INK = '#141414'

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function toFeatureCollection(inputs: MapMarkerInput[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: inputs.map((input) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [input.lng, input.lat] },
      properties: {
        id: input.id,
        // Keep GPU labels short — the full title lives in the preview card.
        name: input.name.length > 28 ? `${input.name.slice(0, 27)}…` : input.name,
        kind: input.kind ?? 'event',
        selected: input.isSelected,
      },
    })),
  }
}

export function createMaplibreAdapter({
  container,
  center,
  zoom,
  onMapClick,
}: CreateMapAdapterParams): MapAdapter {
  const map = new maplibregl.Map({
    container,
    style: MAPLIBRE_STYLE_URL,
    center,
    zoom,
    attributionControl: { compact: true },
  })

  // North-up, flat map. Accidental two-finger rotation/pitch is the #1
  // "the map feels broken" trigger on phones — Airbnb and Google's mobile
  // discovery maps lock both.
  map.dragRotate.disable()
  map.touchZoomRotate.disableRotation()
  map.touchPitch.disable()
  map.keyboard.disableRotation()

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

  // Latest marker inputs by id — click events on the GPU layers dispatch
  // back to each input's onClick through this map.
  let inputsById = new Map<string, MapMarkerInput>()
  let styleReady = false
  let pendingData: GeoJSON.FeatureCollection | null = null

  map.on('load', () => {
    // An invalid layer spec makes addLayer THROW, which would abort this
    // handler halfway and leave a half-configured map (some layers missing,
    // styleReady stuck false, pins frozen). Fail loudly instead.
    try {
      addPinLayers()
      styleReady = true
      pendingData = null
    } catch (error) {
      console.error('MapLibre pin layer setup failed:', error)
    }
  })

  function addPinLayers() {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: pendingData ?? EMPTY_FC,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 46,
    })

    map.addLayer({
      id: LAYER_CLUSTERS,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': 'rgba(5, 5, 5, 0.88)',
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 25],
        'circle-stroke-width': 2,
        'circle-stroke-color': FLAME,
      },
    })

    map.addLayer({
      id: LAYER_CLUSTER_COUNT,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Bold'],
        'text-size': 13,
      },
      paint: { 'text-color': '#ffffff' },
    })

    // Soft flame glow under the selected pin so it reads instantly.
    map.addLayer({
      id: LAYER_SELECTED_HALO,
      type: 'circle',
      source: SOURCE_ID,
      filter: [
        'all',
        ['!', ['has', 'point_count']],
        ['boolean', ['get', 'selected'], false],
      ],
      paint: {
        'circle-color': 'rgba(238, 28, 37, 0.28)',
        'circle-blur': 0.4,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 17, 10, 24, 15, 32],
      },
    })

    map.addLayer({
      id: LAYER_POINTS,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        // Events burn flame red; venues are ink dots — both pop on the
        // light basemap without shouting over each other.
        'circle-color': ['match', ['get', 'kind'], 'venue', INK, FLAME],
        // NOTE: ['zoom'] is only legal inside a TOP-LEVEL interpolate/step —
        // wrapping it in ['+', …] fails validation, addLayer throws, and the
        // whole pin layer silently never exists. Selection boost therefore
        // lives inside each stop instead.
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          3, ['case', ['boolean', ['get', 'selected'], false], 9.5, 7],
          10, ['case', ['boolean', ['get', 'selected'], false], 13, 10],
          15, ['case', ['boolean', ['get', 'selected'], false], 17, 14],
        ],
        'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 3.5, 2.5],
        'circle-stroke-color': '#ffffff',
      },
    })

    // Event titles under the dots, from far out — the collision engine hides
    // overlapping ones automatically, so isolated events are named almost
    // immediately while dense areas stay clean until the user zooms.
    map.addLayer({
      id: LAYER_POINT_LABELS,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      minzoom: 4,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 10, 12.5, 14, 13.5],
        'text-anchor': 'top',
        'text-offset': [0, 1.2],
        'text-max-width': 9,
      },
      paint: {
        'text-color': '#1a1a1a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.4,
      },
    })
  }

  map.on('error', (event) => {
    console.error('MapLibre error:', event)
  })

  map.on('click', LAYER_POINTS, (e) => {
    const feature = e.features?.[0]
    const id = feature?.properties?.id as string | undefined
    if (!id) return
    inputsById.get(id)?.onClick()
  })

  map.on('click', LAYER_CLUSTERS, async (e) => {
    const feature = e.features?.[0]
    if (!feature) return
    const clusterId = feature.properties?.cluster_id as number
    const source = map.getSource(SOURCE_ID) as GeoJSONSource
    try {
      const expansionZoom = await source.getClusterExpansionZoom(clusterId)
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom: expansionZoom + 0.4,
        duration: 550,
        // Explicit zeros — camera padding set by an earlier flyTo is sticky
        // and would off-center the expanded cluster.
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      })
    } catch {
      // Cluster dissolved between render and click — nothing to expand.
    }
  })

  // Blank-map clicks deselect; clicks that hit a pin/cluster are handled by
  // the layer handlers above and must not double-fire a deselect.
  map.on('click', (e) => {
    if (styleReady) {
      const hits = map.queryRenderedFeatures(e.point, { layers: CLICKABLE_LAYERS })
      if (hits.length > 0) return
    }
    onMapClick()
  })

  for (const layerId of CLICKABLE_LAYERS) {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = ''
    })
  }

  return {
    setMarkers(markerInputs) {
      inputsById = new Map(markerInputs.map((input) => [input.id, input]))
      const data = toFeatureCollection(markerInputs)
      if (styleReady) {
        ;(map.getSource(SOURCE_ID) as GeoJSONSource).setData(data)
      } else {
        pendingData = data
      }
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
      map.remove()
    },
  }
}
