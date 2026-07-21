'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Copy,
  MessageCircle,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.47h-1.27c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06Z" />
    </svg>
  )
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.51 8.59L23 22h-6.844l-5.36-7.014L4.7 22H1.44l8.04-9.196L1 2h7.005l4.846 6.41L18.244 2Zm-2.398 18h1.81L7.247 4h-1.93l10.529 16Z" />
    </svg>
  )
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311 1.266-.058 1.646-.07 4.85-.07Zm0 1.802c-3.15 0-3.523.012-4.768.069-1.02.047-1.574.217-1.943.36-.489.19-.837.417-1.203.783-.366.366-.593.714-.783 1.203-.143.369-.313.923-.36 1.943-.057 1.245-.069 1.618-.069 4.768s.012 3.523.069 4.768c.047 1.02.217 1.574.36 1.943.19.489.417.837.783 1.203.366.366.714.593 1.203.783.369.143.923.313 1.943.36 1.245.057 1.618.069 4.768.069s3.523-.012 4.768-.069c1.02-.047 1.574-.217 1.943-.36.489-.19.837-.417 1.203-.783.366-.366.593-.714.783-1.203.143-.369.313-.923.36-1.943.057-1.245.069-1.618.069-4.768s-.012-3.523-.069-4.768c-.047-1.02-.217-1.574-.36-1.943a3.24 3.24 0 0 0-.783-1.203 3.24 3.24 0 0 0-1.203-.783c-.369-.143-.923-.313-1.943-.36-1.245-.057-1.618-.069-4.768-.069Zm0 3.905a5.13 5.13 0 1 1 0 10.26 5.13 5.13 0 0 1 0-10.26Zm0 1.802a3.328 3.328 0 1 0 0 6.656 3.328 3.328 0 0 0 0-6.656Zm5.338-3.205a1.2 1.2 0 1 1 0 2.399 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  )
}

import type { ShareEventData } from '@/lib/share/types'
import { trackInteraction } from '@/lib/track'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { buildCaption, buildShortText } from '@/lib/share/captions'

type Props = {
  open: boolean
  onClose: () => void
  data: ShareEventData
  /** Poster Studio entitlement — admins + granted/paying accounts. */
  studioAccess?: boolean
}

/**
 * Quick sharing only: copy the link, hand it to the OS sheet, or fire a
 * platform intent. All CREATION (posters, reels, captions) lives in AlbaGo
 * Studio at /studio/[slug] — a visible, WYSIWYG surface — which this modal
 * links into for Studio members. Keeping capture DOM out of the modal removes
 * an entire class of silent "nothing happened" failures.
 */
export default function ShareModal({ open, onClose, data, studioAccess = false }: Props) {
  const { t } = useLanguage()

  const caption = useMemo(() => buildCaption(data), [data])
  const shortText = useMemo(() => buildShortText(data), [data])

  const [copied, setCopied] = useState(false)
  const [igCopied, setIgCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const encodedUrl = encodeURIComponent(data.eventUrl)
  const encodedCaption = encodeURIComponent(caption)
  const encodedShort = encodeURIComponent(shortText)

  const whatsappHref = `https://wa.me/?text=${encodedCaption}%20${encodedUrl}`
  const telegramHref = `https://t.me/share/url?url=${encodedUrl}&text=${encodedShort}`
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodedShort}&url=${encodedUrl}`

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const trackShare = useCallback(
    (platform: string) => {
      trackInteraction('share_click', {
        entityType: 'event',
        platform,
        city: data.city,
        country: data.country,
        meta: { slug: data.slug, civic: data.isCivic },
      })
    },
    [data.city, data.country, data.slug, data.isCivic],
  )

  const handleCopyLink = useCallback(async () => {
    trackShare('copy_link')
    try {
      await navigator.clipboard.writeText(data.eventUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — the platform buttons still work.
    }
  }, [data.eventUrl, trackShare])

  // Instagram has no web share intent, so: copy the link, then open Instagram
  // for the user to paste it into a story, post or DM.
  const handleInstagram = useCallback(async () => {
    trackShare('instagram')
    try {
      await navigator.clipboard.writeText(data.eventUrl)
      setIgCopied(true)
      setTimeout(() => setIgCopied(false), 2600)
    } catch {
      // Clipboard unavailable — still open Instagram.
    }
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
  }, [data.eventUrl, trackShare])

  const handleNativeShare = useCallback(async () => {
    if (!canNativeShare) {
      handleCopyLink()
      return
    }
    trackShare('native')
    try {
      await navigator.share({ title: data.title, text: caption, url: data.eventUrl })
    } catch {
      // user dismissed
    }
  }, [canNativeShare, data.title, data.eventUrl, caption, handleCopyLink, trackShare])

  if (!open) return null

  // Portal to <body>: the modal can be mounted deep inside sticky/blurred
  // containers (event page action panel) whose stacking contexts would
  // otherwise trap the overlay underneath page content.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share event"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 text-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-flame-500/15 text-flame-300">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t('share_event_title')}</p>
              <p className="text-[11px] text-white/45">{t('share_event_sub')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/65 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  {t('share_link_copied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t('share_copy_link')}
                </>
              )}
            </button>
            {canNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-flame-500/30 bg-flame-500/10 px-4 py-2.5 text-sm font-semibold text-flame-100 transition hover:bg-flame-500/20"
              >
                <Smartphone className="h-4 w-4" />
                {t('share_title')}
              </button>
            )}
          </div>

          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {t('share_send_platform')}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <a
              href={whatsappHref}
              onClick={() => trackShare('whatsapp')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              <MessageCircle className="h-5 w-5 text-emerald-300" />
              WhatsApp
            </a>
            <button
              type="button"
              onClick={handleInstagram}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              {igCopied ? (
                <Check className="h-5 w-5 text-emerald-400" />
              ) : (
                <InstagramGlyph className="h-5 w-5 text-pink-400" />
              )}
              {igCopied ? t('share_link_copied') : 'Instagram'}
            </button>
            <a
              href={telegramHref}
              onClick={() => trackShare('telegram')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              <Send className="h-5 w-5 text-sky-300" />
              Telegram
            </a>
            <a
              href={facebookHref}
              onClick={() => trackShare('facebook')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              <FacebookGlyph className="h-5 w-5 text-blue-400" />
              Facebook
            </a>
            <a
              href={twitterHref}
              onClick={() => trackShare('twitter')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              <XGlyph className="h-5 w-5 text-white" />
              X / Twitter
            </a>
          </div>

          {/* AlbaGo Studio — the creation surface. Invite-only. */}
          {studioAccess && (
            <Link
              href={`/studio/${data.slug}`}
              onClick={() => trackShare('studio_open')}
              className="group mt-6 flex items-center gap-4 rounded-2xl border border-flame-500/25 bg-gradient-to-r from-flame-500/[0.12] to-transparent p-4 transition hover:border-flame-500/45 hover:from-flame-500/[0.18]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-flame-500/50 to-flame-700/30 text-flame-100">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-lg leading-tight"
                  style={{
                    fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
                  }}
                >
                  AlbaGo <span className="italic text-flame-400">Studio</span>
                </p>
                <p className="text-[11px] text-white/55">{t('studio_entry_sub')}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-flame-300 transition group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
