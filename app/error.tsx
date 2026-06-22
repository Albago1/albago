'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (typeof console !== 'undefined') {
      console.error('Global error boundary captured:', error)
    }
  }, [error])

  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <section className="relative isolate overflow-hidden pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-radial-flame" />
        </div>

        <div className="mx-auto max-w-2xl px-5 sm:px-8 pb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-flame-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Something broke</span>
          </div>

          <h1 className="display-text mt-6 text-4xl sm:text-6xl leading-[0.95] tracking-tight">
            That didn&apos;t <span className="italic text-flame-400">work</span>.
          </h1>

          <p className="mt-5 text-base sm:text-lg leading-relaxed text-white/65">
            We hit an unexpected error rendering this page. The team has been
            notified. Try again, or head back home.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_-4px_rgba(238,28,37,0.55)] transition hover:bg-flame-500/90"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/25 hover:text-white"
            >
              <Home className="h-4 w-4" />
              Go home
            </Link>
          </div>

          {isDev && (
            <details className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/55">
              <summary className="cursor-pointer text-white/75">
                Dev details
              </summary>
              <pre className="mt-3 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-white/70">
                {error.name}: {error.message}
                {error.digest ? `\nDigest: ${error.digest}` : ''}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
          )}
        </div>
      </section>
    </div>
  )
}
