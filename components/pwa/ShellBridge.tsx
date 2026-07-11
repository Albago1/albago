'use client'

import { useEffect } from 'react'
import { getCapacitor, isNativeShell } from '@/lib/pwa'

/**
 * Native niceties when the site runs inside the Capacitor store shell
 * (apps/shell, master plan APP-2). No-op in every browser: the shell
 * injects window.Capacitor, the website bundles nothing native.
 *
 * - Status bar themed ink to blend with the app chrome.
 * - Universal/app links (appUrlOpen) navigate in-place instead of
 *   bouncing through the system browser.
 */
export default function ShellBridge() {
  useEffect(() => {
    if (!isNativeShell()) return
    const plugins = getCapacitor()?.Plugins

    // Style.Dark = light content on a dark background.
    plugins?.StatusBar?.setStyle({ style: 'DARK' }).catch(() => {})
    plugins?.StatusBar?.setBackgroundColor({ color: '#050505' }).catch(() => {})

    let removeListener: (() => void) | undefined
    plugins?.App?.addListener('appUrlOpen', ({ url }) => {
      try {
        const target = new URL(url)
        if (target.hostname.endsWith('albago.org')) {
          window.location.href =
            target.pathname + target.search + target.hash
        }
      } catch {
        // Malformed deep link — ignore.
      }
    })
      .then((handle) => {
        removeListener = handle.remove
      })
      .catch(() => {})

    return () => {
      removeListener?.()
    }
  }, [])

  return null
}
