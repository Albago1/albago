'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Lock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setHasSession(Boolean(data.user))
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setErrorMessage(null)

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setMessage('Password updated. Redirecting to your dashboard...')
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1200)
  }

  return (
    <main className="min-h-screen bg-ink-950 px-4 py-16 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/sign-in"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
          <div className="text-center">
            <p className="font-display text-2xl font-normal text-white/85">
              AlbaGo
            </p>
            <h1 className="mt-6 text-3xl font-bold tracking-tight">
              Set new password
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Choose a new password for your AlbaGo account.
            </p>
          </div>

          {hasSession === false ? (
            <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-300" />
              <p className="mt-4 text-sm text-amber-100">
                This link is invalid or has expired.
              </p>
              <Link
                href="/forgot-password"
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/30"
              >
                Request a new link
              </Link>
            </div>
          ) : message ? (
            <div className="mt-8 rounded-3xl border border-green-500/20 bg-green-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-300" />
              <p className="mt-4 text-sm text-green-100">{message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                  New password
                </span>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                    aria-hidden="true"
                  />
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm outline-none transition placeholder:text-white/30 focus:border-flame-500/40 focus:ring-2 focus:ring-flame-500/20"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                  Confirm password
                </span>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                    aria-hidden="true"
                  />
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    minLength={6}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm outline-none transition placeholder:text-white/30 focus:border-flame-500/40 focus:ring-2 focus:ring-flame-500/20"
                  />
                </div>
              </label>

              {errorMessage && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                disabled={isLoading || hasSession === null}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 text-sm font-semibold shadow-[0_12px_30px_-12px_rgba(238,28,37,0.6)] transition hover:bg-flame-400 disabled:opacity-60"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
