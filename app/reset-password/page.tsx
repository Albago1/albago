'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { authErrorKey, passwordOk } from '@/lib/authErrors'
import AuthShell from '@/components/auth/AuthShell'
import AuthErrorNote from '@/components/auth/AuthErrorNote'
import PasswordChecklist from '@/components/auth/PasswordChecklist'
import { AuthPasswordInput } from '@/components/auth/AuthInput'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const next = searchParams.get('next') ?? '/dashboard'
  const safeNext =
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
      ? next
      : '/dashboard'
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [done, setDone] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
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
    setErrorKey(null)

    // Same standard the sign-up checklist shows (the old page said 6 here).
    if (!passwordOk(password)) {
      setErrorKey('auth_err_weak_password')
      return
    }
    if (password !== confirmPassword) {
      setErrorKey('auth_err_password_mismatch')
      return
    }

    setIsLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsLoading(false)

    if (error) {
      setErrorKey(authErrorKey(error))
      return
    }

    setDone(true)
    setTimeout(() => {
      router.push(safeNext)
      router.refresh()
    }, 1200)
  }

  return (
    <AuthShell
      backHref="/sign-in"
      backLabel={t('auth_back_signin')}
      title={t('auth_reset_title')}
      subtitle={t('auth_reset_sub')}
    >
      {hasSession === false ? (
        <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-300" />
          <p className="mt-4 text-sm text-amber-100">{t('auth_reset_expired')}</p>
          <Link
            href="/forgot-password"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/30"
          >
            {t('auth_reset_request_new')}
          </Link>
        </div>
      ) : done ? (
        <div className="mt-8 rounded-3xl border border-green-500/20 bg-green-500/10 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-300" />
          <p className="mt-4 text-sm text-green-100">{t('auth_reset_done')}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <AuthPasswordInput
              label={t('auth_new_password_label')}
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

          <AuthPasswordInput
            label={t('auth_confirm_password_label')}
            icon={Lock}
            required
            autoComplete="new-password"
            placeholder={t('auth_confirm_password_placeholder')}
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {errorKey && <AuthErrorNote message={t(errorKey)} />}

          <button
            disabled={isLoading || hasSession === null}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 text-sm font-semibold shadow-[0_12px_30px_-12px_rgba(238,28,37,0.6)] transition hover:bg-flame-400 disabled:opacity-60"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? t('auth_reset_button_loading') : t('auth_reset_button')}
          </button>
        </form>
      )}
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
