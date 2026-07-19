'use client'

import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

/**
 * True after hydration, false during SSR and the hydration render.
 * The canonical replacement for the `const [mounted, setMounted] = useState`
 * + mount-effect pattern: useSyncExternalStore flips to the client snapshot
 * immediately after hydration with no effect and no cascading render lint.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}
