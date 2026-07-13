'use client'

import { useEffect, useRef } from 'react'

/**
 * A cinematic searchlight over the hero poster wall: a flame-tinted light that
 * follows the pointer on desktop and drifts on its own when idle (so touch
 * visitors, who never hover, still see it move). The posters under the beam
 * brighten (flame glow, screen blend) while everything around dims (dark
 * radial) — like a torch sweeping a wall of real posters.
 *
 * Purely decorative: aria-hidden, pointer-events-none, and it honors
 * prefers-reduced-motion by parking the light in the centre.
 */
export default function HeroSpotlight() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      el.style.setProperty('--spot-x', '50%')
      el.style.setProperty('--spot-y', '42%')
      return
    }

    // Target = where the light wants to be (pointer, or an idle orbit); pos =
    // where it is. Lerping pos → target gives the light a smooth, trailing feel.
    const target = { x: 0.5, y: 0.42 }
    const pos = { x: 0.5, y: 0.42 }
    let lastMove = 0
    let raf = 0

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const y = (e.clientY - rect.top) / rect.height
      // Ignore movement well outside the hero band so the light doesn't chase
      // the pointer across the rest of the page.
      if (y < -0.25 || y > 1.25) return
      const x = (e.clientX - rect.left) / rect.width
      target.x = Math.min(1, Math.max(0, x))
      target.y = Math.min(1, Math.max(0, y))
      lastMove = performance.now()
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const tick = (t: number) => {
      // No pointer for a beat → resume a slow automatic sweep.
      if (t - lastMove > 2000) {
        const s = t / 3600
        target.x = 0.5 + Math.cos(s) * 0.3
        target.y = 0.42 + Math.sin(s * 1.3) * 0.18
      }
      pos.x += (target.x - pos.x) * 0.06
      pos.y += (target.y - pos.y) * 0.06
      el.style.setProperty('--spot-x', `${(pos.x * 100).toFixed(2)}%`)
      el.style.setProperty('--spot-y', `${(pos.y * 100).toFixed(2)}%`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      <div className="hero-spotlight-dark absolute inset-0" />
      <div className="hero-spotlight-glow absolute inset-0" />
    </div>
  )
}
