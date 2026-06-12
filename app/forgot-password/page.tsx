'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage(null)
    setErrorMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
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
    <main className="min-h-screen bg-ink-950 px-4 py-24 text-white">
      <div className="mx-auto max-w-md rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <Link href="/sign-in" className="mb-5 inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white/90">
          ← Sign in
        </Link>
        <h1 className="text-3xl font-bold">Reset password</h1>
        <p className="mt-2 text-sm text-white/55">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none"
          />

          {message && (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <button
            disabled={isLoading}
            className="h-12 w-full rounded-2xl bg-flame-500 text-sm font-semibold disabled:opacity-60"
          >
            {isLoading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-5 text-sm text-white/55">
          Remembered it?{' '}
          <Link href="/sign-in" className="text-flame-400">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
