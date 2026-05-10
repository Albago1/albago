'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage(null)
    setErrorMessage(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    setIsLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (data.session) {
      router.push('/')
      router.refresh()
      return
    }

    setMessage('Account created. Check your email to confirm, then sign in.')
  }

  return (
    <main className="min-h-screen bg-[#070b14] px-4 py-24 text-white">
      <div className="mx-auto max-w-md rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white/90">
          ← AlbaGo
        </Link>
        <h1 className="text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-sm text-white/55">
          Create your AlbaGo account.
        </p>

        <form onSubmit={handleSignUp} className="mt-8 space-y-4">
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none"
          />

          <input
            required
            type="password"
            placeholder="Password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none"
          />

          {message && (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
              <p>{message}</p>
              <Link
                href="/sign-in"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1.5 text-xs font-semibold text-green-100 transition hover:bg-green-500/30"
              >
                Go to sign in →
              </Link>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <button
            disabled={isLoading}
            className="h-12 w-full rounded-2xl bg-blue-600 text-sm font-semibold disabled:opacity-60"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-sm text-white/55">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-blue-400">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}