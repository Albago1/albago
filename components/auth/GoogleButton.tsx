'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { authErrorKey } from '@/lib/authErrors'

export function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

/**
 * "Continue with Google" — shared by sign-up and sign-in (the logo SVG used
 * to be duplicated in both). Shows a spinner from click until the OAuth
 * redirect actually navigates away, so double-taps don't fire twice.
 */
export default function GoogleButton({
  next,
  onError,
}: {
  next: string
  /** Receives a translated, human error message. */
  onError: (message: string) => void
}) {
  const { t } = useLanguage()
  const [redirecting, setRedirecting] = useState(false)
  const supabase = createClient()

  const handleClick = async () => {
    if (redirecting) return
    setRedirecting(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      setRedirecting(false)
      onError(t(authErrorKey(error)))
    }
    // Success = the browser is navigating to Google; keep the spinner.
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={redirecting}
      className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white text-sm font-semibold text-ink-950 transition hover:bg-white/90 disabled:opacity-70"
    >
      {redirecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <GoogleLogo />
      )}
      {t('auth_google')}
    </button>
  )
}
