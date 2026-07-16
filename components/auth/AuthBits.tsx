'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

/** "or continue with email" divider between Google and the form. */
export function AuthDivider() {
  const { t } = useLanguage()
  return (
    <div className="my-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
      <div className="h-px flex-1 bg-white/10" />
      {t('auth_or_email')}
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

/**
 * The legal footer, with the terms and privacy pages actually linked (the
 * old pages claimed agreement to documents you couldn't reach from there).
 * Composed from parts so German verb-final word order works (suffix " zu.").
 */
export function AuthLegalLine() {
  const { t } = useLanguage()
  return (
    <p className="mt-6 text-center text-xs leading-5 text-white/35">
      {t('auth_legal_prefix')}{' '}
      <Link href="/terms" className="underline decoration-white/25 underline-offset-2 transition hover:text-white/60">
        {t('auth_legal_terms')}
      </Link>{' '}
      {t('auth_legal_and')}{' '}
      <Link href="/privacy" className="underline decoration-white/25 underline-offset-2 transition hover:text-white/60">
        {t('auth_legal_privacy')}
      </Link>
      {t('auth_legal_suffix')}
    </p>
  )
}
