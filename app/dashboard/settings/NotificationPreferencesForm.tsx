'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

type Props = {
  initialSavedEventUpdates: boolean
}

export default function NotificationPreferencesForm({
  initialSavedEventUpdates,
}: Props) {
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
      setErrorMessage('Session expired — please sign in again.')
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
      setErrorMessage(error.message)
      return
    }

    setMessage('Saved.')
    setTimeout(() => setMessage(null), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">
            Saved event updates
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Email me when a saved event changes — new date, time, address, or
            cancellation.
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
