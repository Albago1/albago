'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const STORAGE_KEY = 'albago:cookie-consent'

type Consent = 'accepted' | 'rejected'

function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'accepted' || v === 'rejected' ? v : null
}

function writeConsent(value: Consent) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, value)
}

export default function CookieConsent() {
  // null = not yet hydrated, undefined = hydrated but no choice yet,
  // 'accepted' / 'rejected' = user picked.
  const [consent, setConsent] = useState<Consent | null | undefined>(null)

  useEffect(() => {
    setConsent(readConsent() ?? undefined)
  }, [])

  const accept = () => {
    writeConsent('accepted')
    setConsent('accepted')
  }
  const reject = () => {
    writeConsent('rejected')
    setConsent('rejected')
  }

  // Pre-hydration → render nothing (avoid SSR mismatch).
  if (consent === null) return null

  return (
    <>
      {consent === 'accepted' && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}

      {consent === undefined && (
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
