'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { authErrorKey } from '@/lib/authErrors'
import AuthShell from '@/components/auth/AuthShell'
import AuthErrorNote from '@/components/auth/AuthErrorNote'
import { AuthInput } from '@/components/auth/AuthInput'

function ForgotPasswordForm() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const next = searchParams.get('next') ?? '/'
  const safeNext =
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
      ? next
      : '/'

  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setSentTo(null)
    setErrorKey(null)

    // The reset email lands on /reset-password, which forwards the user to
    // `next` after they set a new password — so someone who started on
    // /submit-event picks up right where they left off.
    const resetPath = `/reset-password?next=${encodeURIComponent(safeNext)}`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(resetPath)}`,
    })

    setIsLoading(false)

    if (error) {
      setErrorKey(authErrorKey(error))
      return
    }

    setSentTo(email)
  }

  return (
    <AuthShell
      backHref={`/sign-in?next=${encodeURIComponent(safeNext)}`}
      backLabel={t('auth_back_signin')}
      title={t('auth_forgot_title')}
      subtitle={t('auth_forgot_sub')}
    >
      {sentTo ? (
        <div className="mt-8 rounded-3xl border border-green-500/20 bg-green-500/10 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-300" />
          <p className="mt-4 text-sm leading-6 text-green-100">
            {t('auth_forgot_sent_prefix')}{' '}
            <span className="font-semibold">{sentTo}</span>,{' '}
            {t('auth_forgot_sent_suffix')}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <AuthInput
            label={t('auth_email_label')}
            icon={Mail}
            required
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {errorKey && <AuthErrorNote message={t(errorKey)} />}

          <button
            disabled={isLoading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 text-sm font-semibold shadow-[0_12px_30px_-12px_rgba(238,28,37,0.6)] transition hover:bg-flame-400 disabled:opacity-60"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? t('auth_forgot_button_loading') : t('auth_forgot_button')}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-white/55">
        {t('auth_remembered')}{' '}
        <Link
          href={`/sign-in?next=${encodeURIComponent(safeNext)}`}
          className="font-semibold text-flame-400 transition hover:text-flame-300"
        >
          {t('auth_signin_cta')}
        </Link>
      </p>
    </AuthShell>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
