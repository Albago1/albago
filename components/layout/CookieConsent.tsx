'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { hasMobileBottomNav } from '@/lib/mobileNav'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const STORAGE_KEY = 'albago:cookie-consent'

type Consent = 'accepted' | 'rejected'
// 'ssr' = server/hydration render (show nothing, avoid mismatch),
// 'none' = hydrated but the user hasn't chosen yet (show the banner).
type ConsentState = Consent | 'none' | 'ssr'

// localStorage is the store; useSyncExternalStore mirrors it so the banner
// state never needs a mount effect and stays consistent across tabs of the
// same page tree.
const listeners = new Set<() => void>()

// Session-only fallback so the banner still dismisses when localStorage is
// unavailable (private mode / storage disabled).
let memoryConsent: Consent | null = null

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function readConsent(): ConsentState {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'accepted' || v === 'rejected') return v
  } catch {
    /* fall through to memory */
  }
  return memoryConsent ?? 'none'
}

function serverConsent(): ConsentState {
  return 'ssr'
}

function writeConsent(value: Consent) {
  memoryConsent = value
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* private mode / storage disabled — memoryConsent covers the session */
  }
  listeners.forEach((notify) => notify())
}

export default function CookieConsent() {
  const consent = useSyncExternalStore(subscribe, readConsent, serverConsent)
  const aboveNav = hasMobileBottomNav(usePathname() ?? '/')

  const accept = () => writeConsent('accepted')
  const reject = () => writeConsent('rejected')

  // Server + hydration render → nothing (avoid SSR mismatch).
  if (consent === 'ssr') return null

  return (
    <>
      {consent === 'accepted' && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}

      {/* One slim bar. On phones it floats just above the bottom nav (or sits
          at the bottom where there is none) so it never hides navigation or
          a third of the first screen. */}
      {consent === 'none' && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className={`fixed inset-x-3 z-[100] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-md ${
            aboveNav
              ? 'bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]'
              : 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]'
          }`}
        >
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-ink-950/90 py-2 pl-4 pr-2 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <p className="min-w-0 flex-1 text-xs leading-snug text-white/70">
              Optional analytics cookies.{' '}
              <Link href="/privacy" className="text-flame-300 hover:underline">
                Privacy
              </Link>
            </p>
            <button
              type="button"
              onClick={reject}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={accept}
              className="shrink-0 rounded-full bg-flame-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-flame-400"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  )
}
