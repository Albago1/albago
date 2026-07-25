'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

type Props = {
  initialDisplayName: string
}

export default function ProfileForm({ initialDisplayName }: Props) {
  const { t } = useLanguage()
  const supabase = createClient()

  const [name, setName] = useState(initialDisplayName)
  const [saved, setSaved] = useState(initialDisplayName)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const trimmed = name.trim()
  const dirty = trimmed !== saved.trim() && trimmed.length > 0

  const persist = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setMessage(null)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      setErrorMessage(t('settings_err_session'))
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)

    setSaving(false)

    if (error) {
      console.error('[display_name]', error.message)
      setErrorMessage("Couldn't save your name — please try again.")
      return
    }

    setSaved(trimmed)
    setMessage(t('settings_saved'))
    setTimeout(() => setMessage(null), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-sm font-semibold text-white">
          {t('settings_name_title')}
        </h3>
        <p className="mt-1 text-sm text-white/55">{t('settings_name_sub')}</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void persist()
            }}
            placeholder={t('settings_name_placeholder')}
            maxLength={60}
            autoComplete="name"
            className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-flame-400/60 focus:bg-white/[0.06]"
          />
          <button
            type="button"
            onClick={() => void persist()}
            disabled={!dirty || saving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-flame-500 px-5 text-sm font-semibold text-white transition active:scale-95 hover:bg-flame-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            {saving ? t('settings_saving') : t('settings_save')}
          </button>
        </div>

        {message && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-300">
            <Check className="h-4 w-4" />
            {message}
          </p>
        )}
        {errorMessage && (
          <p className="mt-3 text-sm text-red-300">{errorMessage}</p>
        )}
      </div>
    </div>
  )
}
