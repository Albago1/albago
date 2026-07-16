'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Lock, Mail, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { authErrorKey } from '@/lib/authErrors'
import AuthShell from '@/components/auth/AuthShell'
import GoogleButton from '@/components/auth/GoogleButton'
import AuthErrorNote from '@/components/auth/AuthErrorNote'
import { AuthInput, AuthPasswordInput } from '@/components/auth/AuthInput'
import { AuthDivider, AuthLegalLine } from '@/components/auth/AuthBits'

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const next = searchParams.get('next') ?? '/'
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>(
    'idle',
  )

  const safeNext =
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
      ? next
      : '/'

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setErrorKey(null)
    setResendStatus('idle')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setIsLoading(false)

    if (error) {
      setErrorKey(authErrorKey(error))
      return
    }

    router.push(safeNext)
    router.refresh()
  }

  // Someone signing in with an unconfirmed email isn't a dead end — offer
  // to send the confirmation link again right from the error.
  const handleResendConfirmation = async () => {
    if (!email || resendStatus === 'sending') return
    setResendStatus('sending')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    })
    if (error) {
      setResendStatus('idle')
      setErrorKey(authErrorKey(error))
      return
    }
    setResendStatus('sent')
  }

  return (
    <AuthShell
      backHref="/"
      backLabel={t('auth_back_home')}
      title={t('auth_signin_title')}
      subtitle={t('auth_signin_sub')}
      below={<AuthLegalLine />}
    >
      <GoogleButton next={safeNext} onError={() => setErrorKey('auth_err_generic')} />
      <AuthDivider />

      <form onSubmit={handleSignIn} className="space-y-4">
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

        <AuthPasswordInput
          label={t('auth_password_label')}
          icon={Lock}
          required
          autoComplete="current-password"
          placeholder={t('auth_password_placeholder_current')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          labelEnd={
            <Link
              href={`/forgot-password?next=${encodeURIComponent(safeNext)}`}
              className="text-xs text-white/55 transition hover:text-white"
            >
              {t('auth_forgot_link')}
            </Link>
          }
        />

        {errorKey && (
          <AuthErrorNote message={t(errorKey)}>
            {errorKey === 'auth_err_email_not_confirmed' && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendStatus !== 'idle'}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-flame-300 transition hover:text-flame-200 disabled:opacity-60"
              >
                {resendStatus === 'sending' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {resendStatus === 'sent' ? t('auth_resent') : t('auth_resend')}
              </button>
            )}
          </AuthErrorNote>
        )}

        <button
          disabled={isLoading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 text-sm font-semibold shadow-[0_12px_30px_-12px_rgba(238,28,37,0.6)] transition hover:bg-flame-400 disabled:opacity-60"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? t('auth_signin_button_loading') : t('auth_signin_button')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/55">
        {t('auth_no_account')}{' '}
        <Link
          href={`/sign-up?next=${encodeURIComponent(safeNext)}`}
          className="font-semibold text-flame-400 transition hover:text-flame-300"
        >
          {t('auth_signup_cta')}
        </Link>
      </p>
    </AuthShell>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
