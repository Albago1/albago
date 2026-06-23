'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'albago-theme'

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark'
}

function applyTheme(next: Theme) {
  if (typeof document === 'undefined') return
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
}

export default function ThemeToggle({
  className = '',
}: {
  className?: string
}) {
  // Always render the same icon on the server (sun, since dark is default)
  // to avoid hydration warnings. Replace with the real value after mount.
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(readTheme())
    setMounted(true)
  }, [])

  const handleClick = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  const isLight = mounted && theme === 'light'
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
