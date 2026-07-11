'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { urlBase64ToUint8Array } from '@/lib/pwa'

type Support = 'checking' | 'ready' | 'unsupported'

/**
 * Per-device web-push opt-in (master plan APP-1d). Subscribes this browser
 * via the service worker and stores the subscription in push_subscriptions
 * (delete + insert per the repo's no-UPDATE RLS pattern). iOS Safari only
 * exposes PushManager once the PWA is installed (16.4+), so unsupported
 * browsers get an install hint instead of a dead switch.
 */
export default function PushDeviceToggle() {
  const { t, language } = useLanguage()
  const supabase = createClient()

  const [support, setSupport] = useState<Support>('checking')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const detect = async () => {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        return { support: 'unsupported' as const, enabled: false }
      }
      // getRegistration (not .ready) — .ready never resolves when no SW is
      // registered, e.g. in dev where PwaRegistrar is production-only.
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        return { support: 'unsupported' as const, enabled: false }
      }
      const subscription = await registration.pushManager.getSubscription()
      return { support: 'ready' as const, enabled: subscription !== null }
    }
    detect()
      .then((result) => {
        if (cancelled) return
        setSupport(result.support)
        setEnabled(result.enabled)
      })
      .catch(() => {
        if (!cancelled) setSupport('unsupported')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enable = async () => {
    setError(null)
    setNotice(null)
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const registration = await navigator.serviceWorker.getRegistration()
    if (!publicKey || !registration) {
      setError(t('push_error'))
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setError(t('push_denied'))
      return
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const keys = subscription.toJSON().keys
    if (!user || !keys?.p256dh || !keys?.auth) {
      await subscription.unsubscribe()
      setError(t('push_error'))
      return
    }
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint)
    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: user.id,
        kind: 'webpush',
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        locale: language,
        user_agent: navigator.userAgent,
      })
    if (insertError) {
      await subscription.unsubscribe()
      setError(t('push_error'))
      return
    }
    setEnabled(true)
  }

  const disable = async () => {
    setError(null)
    setNotice(null)
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint)
      await subscription.unsubscribe()
    }
    setEnabled(false)
  }

  const handleToggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (enabled) {
        await disable()
      } else {
        await enable()
      }
    } catch {
      setError(t('push_error'))
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/push/test', { method: 'POST' })
      if (response.ok) {
        setNotice(t('push_test_sent'))
      } else {
        setError(t('push_test_failed'))
      }
    } catch {
      setError(t('push_test_failed'))
    } finally {
      setBusy(false)
    }
  }

  if (support === 'checking') return null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">
            {t('push_device_title')}
          </h2>
          <p className="mt-1 text-sm text-white/55">
            {support === 'unsupported'
              ? t('push_unsupported')
              : t('push_device_body')}
          </p>
          {support === 'ready' && enabled && (
            <button
              type="button"
              onClick={handleTest}
              disabled={busy}
              className="mt-3 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
            >
              {t('push_test')}
            </button>
          )}
        </div>
        {support === 'ready' && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={handleToggle}
            className={`relative h-7 w-12 flex-shrink-0 rounded-full transition disabled:opacity-60 ${
              enabled ? 'bg-flame-500' : 'bg-white/15'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                enabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        )}
      </div>

      {notice && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  )
}
