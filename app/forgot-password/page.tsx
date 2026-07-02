'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Mail,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

function ForgotPasswordForm() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'
  const safeNext =
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
      ? next
      : '/'

  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage(null)
    setErrorMessage(null)

    // The reset email lands on /reset-password, which forwards the user to
    // `next` after they set a new password — so someone who started on
    // /submit-event picks up right where they left off.
    const resetPath = `/reset-password?next=${encodeURIComponent(safeNext)}`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(resetPath)}`,
    })

    setIsLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setMessage(
      `If an account exists for ${email}, we've sent a link to reset your password. Check your inbox.`,
    )
  }

  return (
    <main className="min-h-screen bg-ink-950 px-4 py-16 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link
          href={`/sign-in?next=${encodeURIComponent(safeNext)}`}
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
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Enter your email and we&apos;ll send you a link to set a new password.
            </p>
          </div>

          {message ? (
            <div className="mt-8 rounded-3xl border border-green-500/20 bg-green-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-300" />
              <p className="mt-4 text-sm text-green-100">{message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                  Email
                </span>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                    aria-hidden="true"
                  />
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                disabled={isLoading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 text-sm font-semibold shadow-[0_12px_30px_-12px_rgba(238,28,37,0.6)] transition hover:bg-flame-400 disabled:opacity-60"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-white/55">
            Remembered it?{' '}
            <Link
              href={`/sign-in?next=${encodeURIComponent(safeNext)}`}
              className="font-semibold text-flame-400 transition hover:text-flame-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
