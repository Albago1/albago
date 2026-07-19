'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'albago-theme'

// The theme lives outside React: an inline <head> script applies the saved
// value to <html data-theme> before hydration, and CSS keys off it. This
// component just mirrors that external store via useSyncExternalStore —
// server/hydration renders assume dark (matching SSR markup), then React
// swaps in the real DOM value immediately after hydration.

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark'
}

function serverTheme(): Theme {
  return 'dark'
}

function applyTheme(next: Theme) {
  if (next === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* private mode / storage disabled — ignore */
  }
  listeners.forEach((notify) => notify())
}

export default function ThemeToggle({
  className = '',
}: {
  className?: string
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme)

  const handleClick = () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const isLight = theme === 'light'
  const label = isLight ? 'Switch to dark mode' : 'Switch to light mode'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      aria-label={label}
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white',
        className,
      ].join(' ')}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}
