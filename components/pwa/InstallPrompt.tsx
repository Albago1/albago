'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Share, SquarePlus } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { isNativeShell, PWA_ENGAGEMENT_EVENT } from '@/lib/pwa'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'albago:pwa-install-dismissed-at'
const IOS_SHOWN_KEY = 'albago:pwa-ios-install-shown'
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000 // one "not now" silences 30 days

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // Storage unavailable — the sheet simply may reappear next session.
  }
}

/**
 * Add-to-home-screen surfaces (master plan APP-1). Never shows unprompted:
 * waits for a PWA_ENGAGEMENT_EVENT (fired after a save), and only if the app
 * isn't already installed and wasn't dismissed in the last 30 days.
 * Chromium gets the real install prompt; iOS Safari gets a one-time
 * instructional sheet (Share → Add to Home Screen).
 */
export default function InstallPrompt() {
  const { t } = useLanguage()
  const [sheet, setSheet] = useState<'install' | 'ios' | null>(null)
  const [installedToast, setInstalledToast] = useState(false)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const isStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    const dismissedRecently = () => {
      try {
        const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
        return Date.now() - at < DISMISS_TTL_MS
      } catch {
        return false
      }
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
    }

    const onEngagement = () => {
      // Inside the Capacitor store shell there is nothing to install.
      if (isNativeShell()) return
      if (isStandalone() || dismissedRecently()) return
      if (promptRef.current) {
        setSheet('install')
        return
      }
      if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
        try {
          if (localStorage.getItem(IOS_SHOWN_KEY)) return
        } catch {
          return
        }
        setSheet('ios')
      }
    }

    const onInstalled = () => {
      promptRef.current = null
      setSheet(null)
      setInstalledToast(true)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(
        () => setInstalledToast(false),
        3500,
      )
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener(PWA_ENGAGEMENT_EVENT, onEngagement)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener(PWA_ENGAGEMENT_EVENT, onEngagement)
      window.removeEventListener('appinstalled', onInstalled)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const handleInstall = async () => {
    const deferred = promptRef.current
    setSheet(null)
    if (!deferred) return
    promptRef.current = null
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'dismissed') markDismissed()
    } catch {
      markDismissed()
    }
  }

  const handleLater = () => {
    markDismissed()
    setSheet(null)
  }

  const handleIosDone = () => {
    try {
      localStorage.setItem(IOS_SHOWN_KEY, '1')
    } catch {
      // ignore
    }
    setSheet(null)
  }

  return (
    <>
      <AnimatePresence>
        {sheet !== null && (
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 bottom-[5.5rem] z-[80] flex justify-center px-4 sm:bottom-6"
          >
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/icon-192.png"
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-2xl border border-white/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">
                    {t('pwa_install_title')}
                  </p>
                  {sheet === 'install' ? (
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {t('pwa_install_body')}
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <p className="flex items-center gap-2 text-xs text-white/70">
                        <Share className="h-4 w-4 shrink-0 text-white/50" />
                        {t('pwa_ios_step_1')}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-white/70">
                        <SquarePlus className="h-4 w-4 shrink-0 text-white/50" />
                        {t('pwa_ios_step_2')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                {sheet === 'install' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleLater}
                      className="rounded-full px-4 py-2 text-xs font-semibold text-white/60 transition hover:text-white"
                    >
                      {t('pwa_install_later')}
                    </button>
                    <button
                      type="button"
                      onClick={handleInstall}
                      className="rounded-full bg-flame-500 px-5 py-2 text-xs font-semibold text-[#fff] transition hover:bg-flame-400"
                    >
                      {t('pwa_install_cta')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleIosDone}
                    className="rounded-full bg-white/10 px-5 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                  >
                    {t('pwa_ios_done')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {installedToast && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 bottom-[5.5rem] z-[80] flex justify-center px-4 sm:bottom-6"
          >
            <p className="rounded-full border border-white/10 bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xl">
              {t('pwa_installed_toast')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
