'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const ROTATE_MS = 3800

/**
 * Rotating hero headline. Renders inside the homepage <h1>; the parent
 * provides an sr-only static slogan, so this whole element is aria-hidden —
 * screen readers hear one stable headline instead of a ticker.
 */
export default function HeroRotator({ slogans }: { slogans: string[] }) {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion || slogans.length < 2) return
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slogans.length)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [reduceMotion, slogans.length])

  const active = reduceMotion ? slogans[0] : slogans[index % slogans.length]

  return (
    <span aria-hidden="true" className="grid">
      {/* Invisible copies of every slogan share the single grid cell so the
          headline always reserves the height of the tallest one — swapping
          never shifts the layout below. */}
      {slogans.map((slogan) => (
        <span key={slogan} className="invisible col-start-1 row-start-1">
          {slogan}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={active}
          className="col-start-1 row-start-1"
          initial={{ opacity: 0, y: '0.4em', filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: '-0.3em', filter: 'blur(6px)' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {active}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
