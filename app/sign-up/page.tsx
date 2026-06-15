'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Mailbox,
  RotateCcw,
  Send,
  User,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

const RESEND_COOLDOWN_SECONDS = 60

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  const handleGoogle = async () => {
    setErrorMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })
    if (error) {
      setErrorMessage(error.message)
    }
  }

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const trimmedName = displayName.trim()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: {
          display_name: trimmedName,
          full_name: trimmedName,
        },
      },
    })

    setIsLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    setSubmittedEmail(email)
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const handleResend = async () => {
    if (!submittedEmail || resendCooldown > 0 || resendStatus === 'sending') return
    setResendStatus('sending')

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: submittedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })

    if (error) {
      setResendStatus('error')
      setErrorMessage(error.message)
      return
    }

    setResendStatus('sent')
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const handleStartOver = () => {
    setSubmittedEmail(null)
    setEmail('')
    setPassword('')
    setDisplayName('')
    setErrorMessage(null)
    setResendStatus('idle')
    setResendCooldown(0)
    setShowPassword(false)
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
          {submittedEmail ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-flame-500/30 bg-flame-500/10">
                <Mailbox className="h-6 w-6 text-flame-300" />
              </div>
              <h1 className="mt-6 font-display text-4xl font-normal tracking-tight text-white">
                Check your inbox.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/65">
                We sent a confirmation link to{' '}
                <span className="font-semibold text-white">{submittedEmail}</span>.
                Click it from your inbox to activate your AlbaGo account. The
                link expires in 24 hours.
              </p>

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Didn&apos;t get it?
                </p>
                <p className="mt-2 text-xs leading-6 text-white/60">
                  Check your spam folder first. Still nothing after a minute?
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resendStatus === 'sending'}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendStatus === 'sending' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : resendStatus === 'sent'
                      ? 'Resent — check inbox'
                      : 'Resend confirmation'}
                </button>
              </div>

              {errorMessage && resendStatus === 'error' && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-left text-sm text-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleStartOver}
                className="mt-6 inline-flex items-center gap-1.5 text-xs text-white/45 transition hover:text-white/75"
              >
                <RotateCcw className="h-3 w-3" />
                Wrong email? Start over
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="font-display text-2xl font-normal text-white/85">
                  AlbaGo
                </p>
                <h1 className="mt-6 font-display text-4xl font-normal tracking-tight">
                  Create your account.
                </h1>
                <p className="mt-2 text-sm text-white/55">
                  Save events, follow movements, and never miss a gathering.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white text-sm font-semibold text-ink-950 transition hover:bg-white/90"
              >
                <GoogleLogo />
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                <div className="h-px flex-1 bg-white/10" />
                or continue with email
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                    Full name
                  </span>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                      aria-hidden="true"
                    />
                    <input
                      required
                      type="text"
                      autoComplete="name"
                      placeholder="Erik Hoxha"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      maxLength={80}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm outline-none transition placeholder:text-white/30 focus:border-flame-500/40 focus:ring-2 focus:ring-flame-500/20"
                    />
                  </div>
                </label>

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
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                    Password
                  </span>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                      aria-hidden="true"
                    />
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      minLength={8}
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
                  {isLoading ? 'Creating account...' : 'Create account'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-white/55">
                Already a member?{' '}
                <Link
                  href="/sign-in"
                  className="font-semibold text-flame-400 transition hover:text-flame-300"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/35">
          By creating an account you agree to our terms and privacy policy.
        </p>
      </div>
    </main>
  )
}
