'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
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

      {consent === 'none' && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-[100] sm:inset-x-auto sm:left-6 sm:bottom-6 sm:max-w-sm"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="rounded-2xl border border-white/15 bg-ink-950/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">
              We use cookies for analytics
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/65">
              Essential cookies keep you signed in. Optional analytics cookies
              help us see which pages are useful. You can change your mind any
              time via{' '}
              <Link href="/privacy" className="text-flame-300 hover:underline">
                Privacy
              </Link>
              .
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={reject}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={accept}
                className="flex-1 rounded-full bg-flame-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] transition hover:bg-flame-500/90"
              >
                Accept all
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
