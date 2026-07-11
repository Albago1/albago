'use client'

import { useEffect } from 'react'

/**
 * Registers the hand-rolled service worker (public/sw.js).
 * Production-only: a SW caching dev-server responses makes local work
 * incoherent (stale HMR chunks served from cache).
 */
export default function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure (private mode, unsupported) is non-fatal —
      // the site simply behaves as a regular website.
    })
  }, [])

  return null
}
