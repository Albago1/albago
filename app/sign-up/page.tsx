'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Loader2,
  Lock,
  Mail,
  Mailbox,
  RotateCcw,
  Send,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { authErrorKey, passwordOk } from '@/lib/authErrors'
import AuthShell from '@/components/auth/AuthShell'
import GoogleButton from '@/components/auth/GoogleButton'
import AuthErrorNote from '@/components/auth/AuthErrorNote'
import PasswordChecklist from '@/components/auth/PasswordChecklist'
import { AuthInput, AuthPasswordInput } from '@/components/auth/AuthInput'
import { AuthDivider, AuthLegalLine } from '@/components/auth/AuthBits'

const RESEND_COOLDOWN_SECONDS = 60

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const next = searchParams.get('next') ?? '/dashboard'
  const supabase = createClient()

  const safeNext =
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
      ? next
      : '/dashboard'

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
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

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorKey(null)

    // Enforce exactly what the checklist shows — no server surprises.
    if (!passwordOk(password)) {
      setErrorKey('auth_err_weak_password')
      return
    }

    setIsLoading(true)
    const trimmedName = displayName.trim()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        data: {
          display_name: trimmedName,
          full_name: trimmedName,
        },
      },
    })

    setIsLoading(false)

    if (error) {
      setErrorKey(authErrorKey(error))
      return
    }

    // Supabase "succeeds" silently for an email that already has an account
    // (anti-enumeration) but returns a user with no identities. Telling the
    // person to check an inbox where nothing will arrive is a dead end —
    // point them to sign-in instead.
    if (data.user && data.user.identities?.length === 0) {
      setErrorKey('auth_err_email_exists')
      return
    }

    if (data.session) {
      router.push(safeNext)
      router.refresh()
      return
    }

    setSubmittedEmail(email)
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const handleResend = async () => {
    if (!submittedEmail || resendCooldown > 0 || resendStatus === 'sending') return
    setResendStatus('sending')
    setErrorKey(null)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: submittedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    })

    if (error) {
      setResendStatus('error')
      setErrorKey(authErrorKey(error))
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
    setErrorKey(null)
    setResendStatus('idle')
    setResendCooldown(0)
  }

  if (submittedEmail) {
    return (
      <AuthShell
        backHref="/"
        backLabel={t('auth_back_home')}
        title={t('auth_inbox_title')}
      >
        <div className="text-center">
          <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-flame-500/30 bg-flame-500/10">
            <Mailbox className="h-6 w-6 text-flame-300" />
          </div>
          <p className="mt-5 text-sm leading-6 text-white/65">
            {t('auth_inbox_body_prefix')}{' '}
            <span className="font-semibold text-white">{submittedEmail}</span>.{' '}
            {t('auth_inbox_body_suffix')}
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {t('auth_inbox_didnt')}
            </p>
            <p className="mt-2 text-xs leading-6 text-white/60">
              {t('auth_inbox_spam')}
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
                ? `${t('auth_resend_wait')} ${resendCooldown}s`
                : resendStatus === 'sent'
                  ? t('auth_resent')
                  : t('auth_resend')}
            </button>
          </div>

          {errorKey && resendStatus === 'error' && (
            <div className="mt-4 text-left">
              <AuthErrorNote message={t(errorKey)} />
            </div>
          )}

          <button
            type="button"
            onClick={handleStartOver}
            className="mt-6 inline-flex items-center gap-1.5 text-xs text-white/45 transition hover:text-white/75"
          >
            <RotateCcw className="h-3 w-3" />
            {t('auth_wrong_email')}
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      backHref="/"
      backLabel={t('auth_back_home')}
      title={t('auth_signup_title')}
      subtitle={t('auth_signup_sub')}
      below={<AuthLegalLine />}
    >
      <GoogleButton next={safeNext} onError={() => setErrorKey('auth_err_generic')} />
      <AuthDivider />

      <form onSubmit={handleSignUp} className="space-y-4">
        <AuthInput
          label={t('auth_name_label')}
          icon={User}
          required
          type="text"
          autoComplete="name"
          placeholder={t('auth_name_placeholder')}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={80}
        />

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

        <div>
          <AuthPasswordInput
            label={t('auth_password_label')}
            icon={Lock}
            required
            autoComplete="new-password"
            placeholder={t('auth_password_placeholder_new')}
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordChecklist password={password} />
        </div>

        {errorKey && (
          <AuthErrorNote message={t(errorKey)}>
            {errorKey === 'auth_err_email_exists' && (
              <Link
                href={`/sign-in?next=${encodeURIComponent(safeNext)}`}
                className="text-sm font-semibold text-flame-300 transition hover:text-flame-200"
              >
                {t('auth_err_email_exists_cta')} →
              </Link>
            )}
          </AuthErrorNote>
        )}

        <button
          disabled={isLoading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 text-sm font-semibold shadow-[0_12px_30px_-12px_rgba(238,28,37,0.6)] transition hover:bg-flame-400 disabled:opacity-60"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? t('auth_signup_button_loading') : t('auth_signup_button')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/55">
        {t('auth_have_account')}{' '}
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

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}
