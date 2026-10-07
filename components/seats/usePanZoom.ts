'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Pan + zoom for an SVG that fills its box (phase 43 seat maps): drag, pinch,
// wheel, double-click and buttons. The camera is a centre + zoom factor over
// the "home" view (all of the content, fitted to the box's shape), so the
// view always has the box's aspect ratio — no letterboxing, and screen →
// map coordinates stay exact when the box is resized.

export type Box = { x: number; y: number; w: number; h: number }
export type Cam = { cx: number; cy: number; k: number }

const TAP_SLOP = 6 // px a pointer may move and still count as a tap

/** The view showing all of `content` in a box with aspect h / w. */
function fit(content: Box, aspect: number, pad: number): Box {
  const cw = content.w * (1 + 2 * pad)
  const ch = content.h * (1 + 2 * pad)
  const w = ch / cw > aspect ? ch / aspect : cw
  const h = w * aspect
  return { x: content.x + content.w / 2 - w / 2, y: content.y + content.h / 2 - h / 2, w, h }
}

const viewOf = (cam: Cam, home: Box): Box => {
  const w = home.w / cam.k
  const h = home.h / cam.k
  return { x: cam.cx - w / 2, y: cam.cy - h / 2, w, h }
}

type Options = {
  content: Box
  maxZoom: number
  pad?: number
  /** Camera to start from once the box size is known (null = all of it). */
  initial?: (home: Box, pxPerUnit: number) => Cam | null
}

export function usePanZoom({ content, maxZoom, pad = 0.03, initial }: Options) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const aspect = size ? size.h / size.w : content.h / content.w
  const home = useMemo(() => fit(content, aspect, pad), [content, aspect, pad])

  const clampCam = useCallback(
    (c: Cam, h: Box): Cam => {
      const k = Math.min(maxZoom, Math.max(1, c.k))
      // Keep the view over the content; centred on an axis it fully shows.
      const axis = (v: number, lo: number, len: number, span: number) => {
        const m = len * pad
        const min = lo - m + span / 2
        const max = lo + len + m - span / 2
        return min >= max ? lo + len / 2 : Math.min(max, Math.max(min, v))
      }
      return {
        k,
        cx: axis(c.cx, content.x, content.w, h.w / k),
        cy: axis(c.cy, content.y, content.h, h.h / k),
      }
    },
    [content, maxZoom, pad],
  )

  const [rawCam, setCam] = useState<Cam>(() => ({
    cx: content.x + content.w / 2,
    cy: content.y + content.h / 2,
    k: 1,
  }))
  const cam = clampCam(rawCam, home)
  const view = viewOf(cam, home)

  // Latest values for the event handlers.
  const live = useRef({ cam, view, home, clampCam, content, initial, pad })
  useEffect(() => {
    live.current = { cam, view, home, clampCam, content, initial, pad }
  })

  // Track the box size; place the first camera once it's known.
  const placed = useRef(false)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return
      setSize({ w: width, h: height })
      if (!placed.current) {
        placed.current = true
        const { content: c, initial: init, pad: p } = live.current
        const h = fit(c, height / width, p)
        const start = init?.(h, width / h.w)
        if (start) setCam(start)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const anim = useRef<number | null>(null)
  useEffect(() => () => {
    if (anim.current) cancelAnimationFrame(anim.current)
  }, [])

  const animateTo = useCallback((target: Cam) => {
    if (anim.current) cancelAnimationFrame(anim.current)
    const { cam: from, home: h, clampCam: clamp } = live.current
    const to = clamp(target, h)
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 420)
      const e = 1 - Math.pow(1 - t, 3)
      setCam({
        cx: from.cx + (to.cx - from.cx) * e,
        cy: from.cy + (to.cy - from.cy) * e,
        k: from.k * Math.pow(to.k / from.k, e),
      })
      anim.current = t < 1 ? requestAnimationFrame(step) : null
    }
    anim.current = requestAnimationFrame(step)
  }, [])

  /** Zoom by `factor` keeping the map point (px, py) where it is on screen. */
  const zoomAround = useCallback(
    (factor: number, px: number, py: number, animate = false) => {
      const { cam: c, view: v, home: h, clampCam: clamp } = live.current
      const k = Math.min(maxZoom, Math.max(1, c.k * factor))
      const w = h.w / k
      const vh = h.h / k
      const x = px - (px - v.x) * (w / v.w)
      const y = py - (py - v.y) * (vh / v.h)
      const next = { k, cx: x + w / 2, cy: y + vh / 2 }
      if (animate) animateTo(next)
      else setCam(clamp(next, h))
    },
    [maxZoom, animateTo],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const { view: v } = live.current
      zoomAround(factor, v.x + v.w / 2, v.y + v.h / 2, true)
    },
    [zoomAround],
  )

  const reset = useCallback(() => {
    const { content: c } = live.current
    animateTo({ cx: c.x + c.w / 2, cy: c.y + c.h / 2, k: 1 })
  }, [animateTo])

  /** Fly to show `box` (in map units). */
  const focusBox = useCallback(
    (box: Box) => {
      const { home: h } = live.current
      animateTo({ cx: box.x + box.w / 2, cy: box.y + box.h / 2, k: Math.min(h.w / box.w, h.h / box.h) })
    },
    [animateTo],
  )

  const toMap = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const { view: v } = live.current
    return {
      x: v.x + ((clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((clientY - rect.top) / rect.height) * v.h,
    }
  }, [])

  // ---- gestures --------------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    startView: Box
    startK: number
    startX: number
    startY: number
    startDist: number
    moved: number
    dragging: boolean
  } | null>(null)
  /** True right after a drag or pinch, so the click that ends it is ignored. */
  const suppressClick = useRef(false)

  const begin = (x: number, y: number, dist: number, moved: number, dragging: boolean) => {
    const { view: v, cam: c } = live.current
    gesture.current = { startView: v, startK: c.k, startX: x, startY: y, startDist: dist, moved, dragging }
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (anim.current) cancelAnimationFrame(anim.current)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    suppressClick.current = false
    if (pts.length === 2) {
      begin(
        (pts[0].x + pts[1].x) / 2,
        (pts[0].y + pts[1].y) / 2,
        Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        0,
        false,
      )
    } else {
      begin(e.clientX, e.clientY, 0, 0, false)
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const rect = svgRef.current!.getBoundingClientRect()
    const { home: h, clampCam: clamp } = live.current
    const pts = [...pointers.current.values()]

    if (pts.length >= 2 && g.startDist > 0) {
      // Pinch: the map point under the fingers stays under the fingers.
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const midX = (pts[0].x + pts[1].x) / 2
      const midY = (pts[0].y + pts[1].y) / 2
      const sv = g.startView
      const k = Math.min(maxZoom, Math.max(1, (g.startK * dist) / g.startDist))
      const w = h.w / k
      const vh = h.h / k
      const ax = sv.x + ((g.startX - rect.left) / rect.width) * sv.w
      const ay = sv.y + ((g.startY - rect.top) / rect.height) * sv.h
      const x = ax - ((midX - rect.left) / rect.width) * w
      const y = ay - ((midY - rect.top) / rect.height) * vh
      setCam(clamp({ k, cx: x + w / 2, cy: y + vh / 2 }, h))
      g.dragging = true
      suppressClick.current = true
      return
    }

    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    g.moved = Math.max(g.moved, Math.hypot(dx, dy))
    if (g.startK <= 1.001 || g.moved < TAP_SLOP) return
    if (!g.dragging) {
      g.dragging = true
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {
        /* pointer already gone — panning still works without capture */
      }
    }
    suppressClick.current = true
    const sv = g.startView
    setCam(
      clamp(
        {
          k: g.startK,
          cx: sv.x + sv.w / 2 - (dx / rect.width) * sv.w,
          cy: sv.y + sv.h / 2 - (dy / rect.height) * sv.h,
        },
        h,
      ),
    )
  }

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      gesture.current = null
      return
    }
    // One finger left after a pinch: carry on as a pan from here.
    const [p] = [...pointers.current.values()]
    begin(p.x, p.y, 0, TAP_SLOP, true)
  }

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = toMap(e.clientX, e.clientY)
      zoomAround(Math.exp(-e.deltaY * 0.0018), p.x, p.y)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [toMap, zoomAround])

  return {
    svgRef,
    view,
    zoom: cam.k,
    size,
    /** Screen pixels per map unit at the current zoom. */
    pxPerUnit: size ? size.w / view.w : 0,
    suppressClick,
    zoomBy,
    reset,
    focusBox,
    svgProps: {
      ref: svgRef,
      viewBox: `${view.x.toFixed(3)} ${view.y.toFixed(3)} ${view.w.toFixed(3)} ${view.h.toFixed(3)}`,
      preserveAspectRatio: 'xMidYMid meet',
      style: { touchAction: 'none' as const },
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => {
        const p = toMap(e.clientX, e.clientY)
        zoomAround(2, p.x, p.y, true)
      },
    },
  }
}
