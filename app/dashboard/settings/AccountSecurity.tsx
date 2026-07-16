'use client'

import { useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { authErrorKey, passwordOk } from '@/lib/authErrors'
import AuthErrorNote from '@/components/auth/AuthErrorNote'
import PasswordChecklist from '@/components/auth/PasswordChecklist'
import { AuthInput, AuthPasswordInput } from '@/components/auth/AuthInput'

function SuccessNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

const CARD_CLASS = 'rounded-3xl border border-white/10 bg-white/[0.03] p-5'

/**
 * Change (or set) the account password without leaving the app — before
 * this card the only path was signing out and using the forgot-password
 * email flow. Accounts that signed up with Google have no password;
 * they get a "set a password" variant that unlocks email sign-in too.
 */
export function ChangePasswordCard({
  email,
  hasPassword,
}: {
  email: string
  hasPassword: boolean
}) {
  const { t } = useLanguage()
  const supabase = createClient()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorKey(null)
    setSaved(false)

    if (!passwordOk(newPassword)) {
      setErrorKey('auth_err_weak_password')
      return
    }

    setIsLoading(true)

    // Supabase's updateUser doesn't verify the old password, so prove it
    // first — a quiet re-sign-in. Skipped for Google-only accounts (there
    // is no current password to prove).
    if (hasPassword) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (verifyError) {
        setIsLoading(false)
        setErrorKey('settings_err_wrong_current')
        return
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsLoading(false)

    if (error) {
      setErrorKey(authErrorKey(error))
      return
    }

    setSaved(true)
    setCurrentPassword('')
    setNewPassword('')
  }

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-flame-400" />
        <h3 className="text-sm font-semibold text-white">
          {t('settings_password_title')}
        </h3>
      </div>
      {!hasPassword && (
        <p className="mt-2 text-sm leading-6 text-white/55">
          {t('settings_password_google_hint')}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {hasPassword && (
          <AuthPasswordInput
            label={t('settings_password_current_label')}
            icon={Lock}
            required
            autoComplete="current-password"
            placeholder={t('auth_password_placeholder_current')}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        )}

        <div>
          <AuthPasswordInput
            label={t('auth_new_password_label')}
            icon={Lock}
            required
            autoComplete="new-password"
            placeholder={t('auth_password_placeholder_new')}
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <PasswordChecklist password={newPassword} />
        </div>

        {errorKey && <AuthErrorNote message={t(errorKey)} />}
        {saved && <SuccessNote message={t('settings_password_updated')} />}

        <button
          disabled={isLoading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-flame-500 px-5 text-sm font-semibold transition hover:bg-flame-400 disabled:opacity-60"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {hasPassword ? t('auth_reset_button') : t('settings_password_set_button')}
        </button>
      </form>
    </div>
  )
}

/**
 * Change the account email. Supabase's secure email change sends
 * confirmation links to BOTH the old and the new address; the switch
 * completes only after confirmation, so this is safe to expose.
 */
export function ChangeEmailCard({ email }: { email: string }) {
  const { t } = useLanguage()
  const supabase = createClient()

  const [newEmail, setNewEmail] = useState('')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorKey(null)
    setSent(false)
    setIsLoading(true)

    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
      },
    )
    setIsLoading(false)

    if (error) {
      setErrorKey(authErrorKey(error))
      return
    }

    setSent(true)
    setNewEmail('')
  }

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-flame-400" />
        <h3 className="text-sm font-semibold text-white">
          {t('settings_email_title')}
        </h3>
      </div>
      <p className="mt-2 text-sm text-white/55">
        {t('settings_email_current')}{' '}
        <span className="font-semibold text-white/85">{email}</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <AuthInput
          label={t('settings_email_new_label')}
          icon={Mail}
          required
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
        />

        {errorKey && <AuthErrorNote message={t(errorKey)} />}
        {sent && <SuccessNote message={t('settings_email_sent')} />}

        <button
          disabled={isLoading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-60"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? t('settings_email_button_loading') : t('settings_email_button')}
        </button>
      </form>
    </div>
  )
}
