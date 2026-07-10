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

// ── Speech-bubble pin images ──
// The pin is a named bubble with a pointer tail aimed at the exact spot,
// color-coded by event category (same palette as the site's category
// system): dark glass body, category ring + dot, baked soft shadow. One
// stretchable sprite per category, scaled around each event's name via
// icon-text-fit — still one GPU symbol per pin, no DOM. Drawn at 2x for
// crisp rendering on retina screens.
const CATEGORY_PIN_COLORS: Record<string, { accent: string; active: string }> = {
  nightlife: { accent: '#e879f9', active: '#c026d3' },
  music: { accent: '#a78bfa', active: '#7c3aed' },
  sports: { accent: '#34d399', active: '#059669' },
  culture: { accent: '#38bdf8', active: '#0284c7' },
  food: { accent: '#fbbf24', active: '#d97706' },
  civic: { accent: FLAME, active: FLAME },
  other: { accent: FLAME, active: FLAME },
}

const PILL_PR = 2
const PILL_M = 6 // margin for the baked shadow
const PILL_BW = 64 // body width
const PILL_BH = 30 // body height
const PILL_R = 14 // corner radius
const PILL_CARET_W = 12
const PILL_CARET_H = 7

type PillSpec = { body: string; ring: string; dot: string }

function createPillImageData(spec: PillSpec): ImageData {
  const s = PILL_PR
  const w = (PILL_BW + PILL_M * 2) * s
  const h = (PILL_BH + PILL_CARET_H + PILL_M * 2) * s
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const m = PILL_M * s
  const bw = PILL_BW * s
  const bh = PILL_BH * s
  const r = PILL_R * s
  const cw = PILL_CARET_W * s
  const ch = PILL_CARET_H * s
  const cx = w / 2

  const tracePath = () => {
    ctx.beginPath()
    ctx.moveTo(m + r, m)
    ctx.lineTo(m + bw - r, m)
    ctx.arcTo(m + bw, m, m + bw, m + r, r)
    ctx.lineTo(m + bw, m + bh - r)
    ctx.arcTo(m + bw, m + bh, m + bw - r, m + bh, r)
    // Bottom edge with the pointer tail
    ctx.lineTo(cx + cw / 2, m + bh)
    ctx.lineTo(cx, m + bh + ch)
    ctx.lineTo(cx - cw / 2, m + bh)
    ctx.lineTo(m + r, m + bh)
    ctx.arcTo(m, m + bh, m, m + bh - r, r)
    ctx.lineTo(m, m + r)
    ctx.arcTo(m, m, m + r, m, r)
    ctx.closePath()
  }

  tracePath()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 4 * s
  ctx.shadowOffsetY = 2 * s
  ctx.fillStyle = spec.body
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  tracePath()
  ctx.strokeStyle = spec.ring
  ctx.lineWidth = 1.5 * s
  ctx.stroke()

  // Category dot in the left cap
  ctx.beginPath()
  ctx.arc(m + 11 * s, m + bh / 2, 3.5 * s, 0, Math.PI * 2)
  ctx.fillStyle = spec.dot
  ctx.fill()

  return ctx.getImageData(0, 0, w, h)
}

// Two stretch bands flank the fixed pointer tail; the vertical band sits in
// the thin straight zone between the corner arcs; content is the box the
// fitted text may occupy (starting right of the baked category dot).
const PILL_IMAGE_OPTIONS = {
  pixelRatio: PILL_PR,
  stretchX: [
    [(PILL_M + PILL_R + 1) * PILL_PR, (PILL_M + PILL_BW / 2 - PILL_CARET_W / 2 - 2) * PILL_PR],
    [(PILL_M + PILL_BW / 2 + PILL_CARET_W / 2 + 2) * PILL_PR, (PILL_M + PILL_BW - PILL_R - 1) * PILL_PR],
  ] as [number, number][],
  stretchY: [
    [(PILL_M + PILL_R) * PILL_PR, (PILL_M + PILL_BH - PILL_R) * PILL_PR],
  ] as [number, number][],
  content: [
    (PILL_M + 18) * PILL_PR,
    (PILL_M + 6) * PILL_PR,
    (PILL_M + PILL_BW - 11) * PILL_PR,
    (PILL_M + PILL_BH - 6) * PILL_PR,
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
        category: CATEGORY_PIN_COLORS[input.category?.toLowerCase() ?? '']
          ? (input.category as string).toLowerCase()
          : 'other',
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

  // Zoom-out floor: horizontal panning wraps around the globe, so only the
  // VERTICAL axis can dead-zone — it sticks once the world map is shorter
  // than the viewport. Floor the zoom so the world stays ~10% taller than
  // the container (world is 512px tall at zoom 0, doubling per level), with
  // an absolute floor of 0.8 so a phone can pull back far enough to see the
  // continents at once and flick-wrap to the rest.
  const computeMinZoom = () => {
    const el = map.getContainer()
    return Math.max(0.8, Math.log2((Math.max(el.clientHeight, 1) * 1.1) / 512))
  }
  map.setMinZoom(computeMinZoom())
  map.on('resize', () => map.setMinZoom(computeMinZoom()))

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
      for (const [category, colors] of Object.entries(CATEGORY_PIN_COLORS)) {
        map.addImage(
          `albago-pill-${category}`,
          createPillImageData({ body: 'rgba(8, 8, 8, 0.94)', ring: colors.accent, dot: colors.accent }),
          PILL_IMAGE_OPTIONS,
        )
        map.addImage(
          `albago-pill-${category}-active`,
          createPillImageData({ body: colors.active, ring: '#ffffff', dot: '#ffffff' }),
          PILL_IMAGE_OPTIONS,
        )
      }
      map.addImage(
        'albago-pill-venue',
        createPillImageData({ body: 'rgba(255, 255, 255, 0.97)', ring: 'rgba(10, 10, 10, 0.30)', dot: INK }),
        PILL_IMAGE_OPTIONS,
      )
      map.addImage(
        'albago-pill-venue-active',
        createPillImageData({ body: INK, ring: '#ffffff', dot: FLAME }),
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
        'circle-color': [
          'case',
          ['==', ['get', 'kind'], 'venue'],
          INK,
          ['match', ['get', 'category'],
            'nightlife', CATEGORY_PIN_COLORS.nightlife.accent,
            'music', CATEGORY_PIN_COLORS.music.accent,
            'sports', CATEGORY_PIN_COLORS.sports.accent,
            'culture', CATEGORY_PIN_COLORS.culture.accent,
            'food', CATEGORY_PIN_COLORS.food.accent,
            FLAME,
          ],
        ],
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
        'icon-image': [
          'case',
          ['==', ['get', 'kind'], 'venue'],
          'albago-pill-venue',
          ['concat', 'albago-pill-', ['get', 'category']],
        ],
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [4, 10, 4, 10],
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11.5, 14, 13],
        'text-max-width': 12,
        // Anchor the text box (and therefore the fitted bubble) above the
        // location so the pointer tail lands on the spot / fallback dot.
        'text-anchor': 'bottom',
        'text-offset': [0, -1.4],
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
        'icon-image': [
          'case',
          ['==', ['get', 'kind'], 'venue'],
          'albago-pill-venue-active',
          ['concat', 'albago-pill-', ['get', 'category'], '-active'],
        ],
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [4, 10, 4, 10],
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 14, 13.5],
        'text-max-width': 12,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.4],
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
