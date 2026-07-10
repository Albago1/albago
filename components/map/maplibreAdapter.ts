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
const LAYER_DOTS = 'albago-dots'
const LAYER_PILLS = 'albago-pills'
const LAYER_PILL_SELECTED = 'albago-pill-selected'
const POINT_CLICK_LAYERS = [LAYER_PILL_SELECTED, LAYER_PILLS, LAYER_DOTS]
const CLICKABLE_LAYERS = [...POINT_CLICK_LAYERS, LAYER_CLUSTERS]

const FLAME = '#EE1C25'
const INK = '#141414'

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

// ── Pill marker images (Airbnb pattern: the pin IS a named pill) ──
// A tiny rounded-rect image is registered with stretch zones so MapLibre can
// scale it around each event's name via icon-text-fit — still one GPU symbol
// per pin, no DOM. Drawn at 2x for crisp rendering on retina screens.
const PILL_PR = 2
const PILL_W = 48
const PILL_H = 30
const PILL_R = 14

function createPillImageData(fill: string, stroke: string): ImageData {
  const w = PILL_W * PILL_PR
  const h = PILL_H * PILL_PR
  const r = PILL_R * PILL_PR
  const lw = 1.5 * PILL_PR
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const x = lw / 2
  const y = lw / 2
  const iw = w - lw
  const ih = h - lw
  const ir = Math.min(r, ih / 2)
  ctx.beginPath()
  ctx.moveTo(x + ir, y)
  ctx.lineTo(x + iw - ir, y)
  ctx.arcTo(x + iw, y, x + iw, y + ir, ir)
  ctx.lineTo(x + iw, y + ih - ir)
  ctx.arcTo(x + iw, y + ih, x + iw - ir, y + ih, ir)
  ctx.lineTo(x + ir, y + ih)
  ctx.arcTo(x, y + ih, x, y + ih - ir, ir)
  ctx.lineTo(x, y + ir)
  ctx.arcTo(x, y, x + ir, y, ir)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = lw
  ctx.stroke()
  return ctx.getImageData(0, 0, w, h)
}

// Stretch bands sit between the rounded corners; content is the box the
// fitted text may occupy.
const PILL_IMAGE_OPTIONS = {
  pixelRatio: PILL_PR,
  stretchX: [[(PILL_R + 1) * PILL_PR, (PILL_W - PILL_R - 1) * PILL_PR]] as [number, number][],
  stretchY: [[(PILL_H / 2 - 2) * PILL_PR, (PILL_H / 2 + 2) * PILL_PR]] as [number, number][],
  content: [
    11 * PILL_PR,
    6 * PILL_PR,
    (PILL_W - 11) * PILL_PR,
    (PILL_H - 6) * PILL_PR,
  ] as [number, number, number, number],
}

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
      map.addImage(
        'albago-pill-event',
        createPillImageData('rgba(8, 8, 8, 0.94)', FLAME),
        PILL_IMAGE_OPTIONS,
      )
      map.addImage(
        'albago-pill-venue',
        createPillImageData('rgba(255, 255, 255, 0.96)', 'rgba(10, 10, 10, 0.35)'),
        PILL_IMAGE_OPTIONS,
      )
      map.addImage(
        'albago-pill-active',
        createPillImageData(FLAME, '#ffffff'),
        PILL_IMAGE_OPTIONS,
      )
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

    // Small dot under every event — the always-visible fallback for spots
    // whose pill was collision-culled in dense areas (Airbnb does exactly
    // this: price pills where they fit, dots where they don't).
    map.addLayer({
      id: LAYER_DOTS,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['match', ['get', 'kind'], 'venue', INK, FLAME],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 10, 5.5, 15, 7],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    })

    // The pin itself is a named pill: ink with a flame ring for events,
    // white for venues. Overlapping pills hide automatically; their dot
    // stays. NOTE: ['zoom'] is only legal inside a TOP-LEVEL
    // interpolate/step — validate layer specs before changing them.
    map.addLayer({
      id: LAYER_PILLS,
      type: 'symbol',
      source: SOURCE_ID,
      filter: [
        'all',
        ['!', ['has', 'point_count']],
        ['!', ['boolean', ['get', 'selected'], false]],
      ],
      layout: {
        'icon-image': ['match', ['get', 'kind'], 'venue', 'albago-pill-venue', 'albago-pill-event'],
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [4, 10, 4, 10],
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11.5, 14, 13],
      },
      paint: {
        'text-color': ['match', ['get', 'kind'], 'venue', '#111111', '#ffffff'],
      },
    })

    // The selected pin flips to a solid flame pill and is exempt from
    // collision — it must never disappear under a neighbor.
    map.addLayer({
      id: LAYER_PILL_SELECTED,
      type: 'symbol',
      source: SOURCE_ID,
      filter: [
        'all',
        ['!', ['has', 'point_count']],
        ['boolean', ['get', 'selected'], false],
      ],
      layout: {
        'icon-image': 'albago-pill-active',
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [4, 10, 4, 10],
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 14, 13.5],
        'icon-allow-overlap': true,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#ffffff',
      },
    })
  }

  map.on('error', (event) => {
    console.error('MapLibre error:', event)
  })

  // A tap on a pill also hits the fallback dot beneath it — dedupe per DOM
  // event so onClick fires once.
  const handledClicks = new WeakSet<MouseEvent>()
  for (const layerId of POINT_CLICK_LAYERS) {
    map.on('click', layerId, (e) => {
      if (handledClicks.has(e.originalEvent)) return
      handledClicks.add(e.originalEvent)
      const feature = e.features?.[0]
      const id = feature?.properties?.id as string | undefined
      if (!id) return
      inputsById.get(id)?.onClick()
    })
  }

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
