'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Smartphone,
  Video,
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
import type { ShareEventData } from '@/lib/share/types'
import { trackInteraction } from '@/lib/track'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { buildCaption, buildShortText } from '@/lib/share/captions'
import { generateQrDataUrl } from '@/lib/share/qr'
import StoryShareTemplate from './templates/StoryShareTemplate'
import SquareShareTemplate from './templates/SquareShareTemplate'
import FacebookShareTemplate from './templates/FacebookShareTemplate'

type Props = {
  open: boolean
  onClose: () => void
  data: ShareEventData
}

type DownloadFormat = 'story' | 'square' | 'facebook'
type VideoDuration = 15 | 30

export default function ShareModal({ open, onClose, data }: Props) {
  const { t } = useLanguage()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(true)

  const initialCaption = useMemo(() => buildCaption(data), [data])
  const [caption, setCaption] = useState(initialCaption)

  const [copied, setCopied] = useState<'link' | 'caption' | null>(null)
  const [downloading, setDownloading] = useState<DownloadFormat | null>(null)
  const [downloaded, setDownloaded] = useState<DownloadFormat | null>(null)
  const [recordingDuration, setRecordingDuration] = useState<VideoDuration | null>(null)
  const [recordedDuration, setRecordedDuration] = useState<VideoDuration | null>(null)
  const [recordProgress, setRecordProgress] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const storyRef = useRef<HTMLDivElement | null>(null)
  const squareRef = useRef<HTMLDivElement | null>(null)
  const facebookRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setCaption(initialCaption)
  }, [open, initialCaption])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setQrLoading(true)
    generateQrDataUrl(data.eventUrl)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, data.eventUrl])

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
  const shortText = useMemo(() => buildShortText(data), [data])
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

  const handleCopy = useCallback(
    async (kind: 'link' | 'caption') => {
      trackShare(kind === 'link' ? 'copy_link' : 'copy_caption')
      try {
        const text = kind === 'link' ? data.eventUrl : caption
        await navigator.clipboard.writeText(text)
        setCopied(kind)
        setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000)
      } catch {
        setError('Copy failed — please copy manually.')
      }
    },
    [data.eventUrl, caption, trackShare],
  )

  const handleNativeShare = useCallback(async () => {
    if (!canNativeShare) {
      handleCopy('link')
      return
    }
    trackShare('native')
    try {
      await navigator.share({ title: data.title, text: caption, url: data.eventUrl })
    } catch {
      // user dismissed
    }
  }, [canNativeShare, data.title, data.eventUrl, caption, handleCopy, trackShare])

  const triggerDownload = useCallback(async (format: DownloadFormat) => {
    trackShare(`download_${format}`)
    setError(null)
    setDownloading(format)
    try {
      const node =
        format === 'story'
          ? storyRef.current
          : format === 'square'
            ? squareRef.current
            : facebookRef.current
      if (!node) {
        throw new Error('Template not ready')
      }
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(node, {
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#050505',
      })
      const safeSlug = (data.slug || 'event').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
      const filename = `albago-${safeSlug}-${format}.png`
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      link.click()
      setDownloaded(format)
      setShowHint(true)
      setTimeout(() => setDownloaded((c) => (c === format ? null : c)), 2400)
    } catch (e) {
      console.error(e)
      setError('Could not generate the image — try again.')
    } finally {
      setDownloading(null)
    }
  }, [data.slug, trackShare])

  const triggerVideoDownload = useCallback(
    async (duration: VideoDuration) => {
      if (recordingDuration !== null) return
      trackShare(`reel_${duration}s`)
      setError(null)
      setRecordingDuration(duration)
      setRecordProgress(0)
      try {
        const node = storyRef.current
        if (!node) throw new Error('Template not ready')
        const { recordPosterVideo } = await import('@/lib/share/recordPosterVideo')
        const { blob, ext } = await recordPosterVideo({
          node,
          durationSec: duration,
          onProgress: (frac) => setRecordProgress(frac),
        })
        const safeSlug = (data.slug || 'event').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
        const filename = `albago-${safeSlug}-reel-${duration}s.${ext}`
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = filename
        link.href = url
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
        setRecordedDuration(duration)
        setShowHint(true)
        setTimeout(
          () => setRecordedDuration((c) => (c === duration ? null : c)),
          2400,
        )
      } catch (e) {
        console.error(e)
        const msg =
          e instanceof Error && e.message
            ? e.message
            : 'Could not record the video — try again.'
        setError(msg)
      } finally {
        setRecordingDuration(null)
        setRecordProgress(0)
      }
    },
    [data.slug, recordingDuration, trackShare],
  )

  if (!open) return null

  return (
    <>
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
                onClick={() => handleCopy('link')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08]"
              >
                {copied === 'link' ? (
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
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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

            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {t('share_download_image')}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => triggerDownload('story')}
                disabled={qrLoading || downloading !== null}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-flame-500/40 to-flame-700/30 text-flame-200">
                  {downloading === 'story' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : downloaded === 'story' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Story / Reel</p>
                  <p className="text-[11px] text-white/50">9:16 · 1080×1920</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => triggerDownload('square')}
                disabled={qrLoading || downloading !== null}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-flame-500/40 to-flame-700/30 text-flame-200">
                  {downloading === 'square' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : downloaded === 'square' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Square post</p>
                  <p className="text-[11px] text-white/50">1:1 · 1080×1080</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => triggerDownload('facebook')}
                disabled={qrLoading || downloading !== null}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-7 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-flame-500/40 to-flame-700/30 text-flame-200">
                  {downloading === 'facebook' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : downloaded === 'facebook' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">FB / OG card</p>
                  <p className="text-[11px] text-white/50">1200×630</p>
                </div>
              </button>
            </div>

            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {t('share_download_reel')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([15, 30] as const).map((sec) => {
                const isRecording = recordingDuration === sec
                const isDone = recordedDuration === sec
                const disabled =
                  qrLoading || downloading !== null ||
                  (recordingDuration !== null && recordingDuration !== sec)
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => triggerVideoDownload(sec)}
                    disabled={disabled}
                    className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRecording && (
                      <div
                        className="absolute inset-y-0 left-0 bg-flame-500/15 transition-[width] duration-150"
                        style={{ width: `${Math.round(recordProgress * 100)}%` }}
                        aria-hidden
                      />
                    )}
                    <div className="relative flex h-10 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-flame-500/40 to-flame-700/30 text-flame-200">
                      {isRecording ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isDone ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <Video className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="relative min-w-0">
                      <p className="text-sm font-semibold text-white">{sec}s Reel</p>
                      <p className="text-[11px] text-white/50">
                        {isRecording
                          ? `Recording ${Math.round(recordProgress * sec)}s / ${sec}s`
                          : '9:16 · video'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-white/40">
              Records in real time — wait for the file to download before posting.
            </p>

            {showHint && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5 text-[12px] text-emerald-100">
                <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                <p>
                  Upload this image or video to Instagram Story/Reel, TikTok, Facebook or
                  WhatsApp and paste the copied caption.
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {t('share_caption')}
              </p>
              <button
                type="button"
                onClick={() => handleCopy('caption')}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-flame-300 transition hover:text-flame-200"
              >
                {copied === 'caption' ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    {t('share_caption_copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    {t('share_copy_caption')}
                  </>
                )}
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={8}
              className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/85 leading-6 focus:border-flame-500/40 focus:outline-none"
              spellCheck={false}
            />

            {error && (
              <p className="mt-3 rounded-2xl border border-flame-500/30 bg-flame-500/[0.08] px-3.5 py-2.5 text-[12px] text-flame-200">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: -100000,
          width: 1080,
          pointerEvents: 'none',
        }}
      >
        <StoryShareTemplate data={data} qrDataUrl={qrDataUrl} innerRef={storyRef} />
        <SquareShareTemplate data={data} qrDataUrl={qrDataUrl} innerRef={squareRef} />
        <FacebookShareTemplate data={data} qrDataUrl={qrDataUrl} innerRef={facebookRef} />
      </div>
    </>
  )
}
