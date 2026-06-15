'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setIsLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    const safeNext =
      next.startsWith('/') &&
      !next.startsWith('//') &&
      !next.startsWith('/\\')
        ? next
        : '/'
    router.push(safeNext)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-ink-950 px-4 py-16 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
          <div className="text-center">
            <p className="font-display text-2xl font-normal text-white/85">
              AlbaGo
            </p>
            <h1 className="mt-6 text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Sign in to continue to your account.
            </p>
          </div>

          <form onSubmit={handleSignIn} className="mt-8 space-y-4">
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

            <label className="block">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                  Password
                </span>
                <Link
                  href="/forgot-password"
                  className="text-xs text-white/55 transition hover:text-white"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                  aria-hidden="true"
                />
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-12 text-sm outline-none transition placeholder:text-white/30 focus:border-flame-500/40 focus:ring-2 focus:ring-flame-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/40 transition hover:text-white/80"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
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
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/55">
            New to AlbaGo?{' '}
            <Link href="/sign-up" className="font-semibold text-flame-400 transition hover:text-flame-300">
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-white/35">
          By signing in you agree to our terms and privacy policy.
        </p>
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
