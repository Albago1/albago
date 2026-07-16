'use client'

import { Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

const CONTACT_EMAIL = 'albago.org@gmail.com'

export default function DeleteAccountButton({ email }: { email: string }) {
  const { t } = useLanguage()
  // The mailto body stays English — it lands in the admin inbox.
  const subject = encodeURIComponent('Account deletion request')
  const body = encodeURIComponent(
    [
      'Hi AlbaGo team,',
      '',
      `Please delete my account and all associated data (saved events, submissions, placards, volunteer signups).`,
      '',
      `Account email: ${email}`,
      '',
      'Thanks.',
    ].join('\n'),
  )
  const href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`

  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/[0.06] px-4 py-2 text-sm font-semibold text-red-300 transition hover:border-red-500/50 hover:bg-red-500/[0.12] hover:text-red-200"
    >
      <Trash2 className="h-4 w-4" />
      {t('settings_delete_button')}
    </a>
  )
}
