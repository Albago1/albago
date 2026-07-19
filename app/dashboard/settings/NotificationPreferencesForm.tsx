'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

type Props = {
  initialSavedEventUpdates: boolean
}

export default function NotificationPreferencesForm({
  initialSavedEventUpdates,
}: Props) {
  const { t } = useLanguage()
  const supabase = createClient()

  const [savedEventUpdates, setSavedEventUpdates] = useState(
    initialSavedEventUpdates,
  )
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const persist = async (next: boolean) => {
    setSavingKey('saved_event_updates')
    setMessage(null)
    setErrorMessage(null)

    const previous = savedEventUpdates
    setSavedEventUpdates(next)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSavedEventUpdates(previous)
      setSavingKey(null)
      setErrorMessage(t('settings_err_session'))
      return
    }

    const { data: row } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .maybeSingle()

    const merged = {
      ...((row?.notification_preferences ?? {}) as Record<string, unknown>),
      saved_event_updates: next,
    }

    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: merged })
      .eq('id', user.id)

    setSavingKey(null)

    if (error) {
      setSavedEventUpdates(previous)
      console.error('[notification_preferences]', error.message)
      setErrorMessage("Couldn't save your preferences — please try again.")
      return
    }

    setMessage(t('settings_saved'))
    setTimeout(() => setMessage(null), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">
            {t('settings_notif_saved_title')}
          </h2>
          <p className="mt-1 text-sm text-white/55">
            {t('settings_notif_saved_sub')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={savedEventUpdates}
          disabled={savingKey === 'saved_event_updates'}
          onClick={() => persist(!savedEventUpdates)}
          className={`relative h-7 w-12 flex-shrink-0 rounded-full transition disabled:opacity-60 ${
            savedEventUpdates ? 'bg-flame-500' : 'bg-white/15'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
              savedEventUpdates ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
