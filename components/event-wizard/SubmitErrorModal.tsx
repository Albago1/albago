'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function SubmitErrorModal({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="submit-error-title"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute inset-0 cursor-default bg-ink-950/80 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-8 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-300" />
        </div>
        <h2 id="submit-error-title" className="mt-5 text-xl font-bold text-white">
          Couldn&apos;t submit your event
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/65">{message}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  )
}
