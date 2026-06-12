'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
    <main className="min-h-screen bg-ink-950 px-4 py-24 text-white">
      <div className="mx-auto max-w-md rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <Link href="/sign-in" className="mb-5 inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white/90">
          ← Sign in
        </Link>
        <h1 className="text-3xl font-bold">Set new password</h1>
        <p className="mt-2 text-sm text-white/55">
          Choose a new password for your AlbaGo account.
        </p>

        {hasSession === false ? (
          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            This link is invalid or has expired. Request a new reset link from{' '}
            <Link href="/forgot-password" className="font-semibold underline">
              forgot password
            </Link>
            .
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              required
              type="password"
              placeholder="New password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none"
            />

            <input
              required
              type="password"
              placeholder="Confirm new password"
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
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
              disabled={isLoading || hasSession === null}
              className="h-12 w-full rounded-2xl bg-flame-500 text-sm font-semibold disabled:opacity-60"
            >
              {isLoading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
