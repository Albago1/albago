'use client'

import { useRef, useState } from 'react'
import { Check, Copy, Download, MessageCircle, Send, Share2 } from 'lucide-react'
import { PLACARD_CATEGORY_LABELS, PLACARD_LANGUAGE_LABELS } from '@/lib/placards'
import type { Placard } from '@/lib/placards'
import { PlacardSquare, PlacardStory } from './PlacardTemplate'

type Props = { placard: Placard }

type DownloadFormat = 'square' | 'story'

const SHARE_URL_BASE = 'https://albago.org/pankartat'

function shareText(placard: Placard): string {
  return `Kam gjetur këtë pankartë në AlbaGo: "${placard.slogan}" — ${SHARE_URL_BASE}`
}

export default function PlacardCard({ placard }: Props) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState<DownloadFormat | null>(null)
  const [renderFormat, setRenderFormat] = useState<DownloadFormat | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const lang = PLACARD_LANGUAGE_LABELS[placard.language]
  const visibleCategories = placard.categories
    .filter((c) => c !== 'short' && c !== 'powerful')
    .slice(0, 2)
  const isShort = placard.categories.includes('short')
  const isPowerful = placard.categories.includes('powerful')

  function flashAction(msg: string) {
    setActionMessage(msg)
    setTimeout(() => setActionMessage(null), 2200)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(placard.slogan)
      setCopied(true)
      flashAction('Mesazhi u kopjua.')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      flashAction('Nuk u kopjua — provo përsëri.')
    }
  }

  async function handleDownload(format: DownloadFormat) {
    setDownloading(format)
    setRenderFormat(format)
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await new Promise((r) => setTimeout(r, 60))
      const node = captureRef.current
      if (!node) throw new Error('render node missing')
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(node, {
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#050505',
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `albago-pankarte-${placard.id}-${format}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      flashAction(format === 'square' ? 'Pankarta u shkarkua (1:1).' : 'Pankarta u shkarkua (9:16).')
    } catch {
      flashAction('Shkarkimi dështoi.')
    } finally {
      setRenderFormat(null)
      setDownloading(null)
    }
  }

  function handleShareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText(placard))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleShareTelegram() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(SHARE_URL_BASE)}&text=${encodeURIComponent(`"${placard.slogan}" — Pankartë në AlbaGo`)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleShareNative() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Pankartë — AlbaGo',
          text: shareText(placard),
          url: SHARE_URL_BASE,
        })
      } catch {
        // user cancelled — silent
      }
    } else {
      flashAction('Share i drejtpërdrejtë nuk është i mbështetur këtu.')
    }
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] transition hover:border-flame-500/40 hover:bg-white/[0.04]">
      {/* Visual preview — mini placard look matching the downloadable template */}
      <div
        className="relative aspect-square overflow-hidden"
        style={{ background: '#050505' }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(238,28,37,0.28) 0%, rgba(0,0,0,0) 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(40% 30% at 50% 100%, rgba(238,28,37,0.18) 0%, rgba(0,0,0,0) 70%)',
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-flame-500" />
              AlbaGo
            </div>
            <div className="rounded-full border border-flame-500/45 bg-flame-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-flame-300">
              Pankartë
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p
              className="text-white"
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize:
                  placard.slogan.length <= 18
                    ? 38
                    : placard.slogan.length <= 28
                      ? 30
                      : placard.slogan.length <= 40
                        ? 24
                        : 20,
                lineHeight: 1.02,
                letterSpacing: '-0.025em',
                wordBreak: 'break-word',
              }}
            >
              {placard.slogan}
            </p>
            <div className="flex items-center gap-2">
              <span className="h-px w-6 bg-flame-500/80" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                {lang.flag} {lang.label}
              </span>
            </div>
          </div>

          <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/40">
            albago.org/pankartat
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleCategories.map((cat) => (
            <span
              key={cat}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70"
            >
              {PLACARD_CATEGORY_LABELS[cat]}
            </span>
          ))}
          {isPowerful && (
            <span className="rounded-full border border-flame-500/30 bg-flame-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-flame-200">
              Të fuqishme
            </span>
          )}
          {isShort && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
              Të shkurtra
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'U kopjua' : 'Kopjo'}
          </button>

          <button
            type="button"
            onClick={() => handleDownload('square')}
            disabled={downloading !== null}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading === 'square' ? 'Duke shkarkuar…' : 'Post 1:1'}
          </button>

          <button
            type="button"
            onClick={() => handleDownload('story')}
            disabled={downloading !== null}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading === 'story' ? 'Duke shkarkuar…' : 'Story 9:16'}
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              aria-label="Share on WhatsApp"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/80 transition hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:text-emerald-200"
              title="WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleShareTelegram}
              aria-label="Share on Telegram"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/80 transition hover:border-sky-400/50 hover:bg-sky-500/10 hover:text-sky-200"
              title="Telegram"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleShareNative}
              aria-label="Share"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/80 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100"
              title="Share"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="text-[11px] font-medium text-white/55">{actionMessage}</div>
        )}
      </div>

      {/* Off-screen render target for html-to-image. Mounted only while downloading. */}
      {renderFormat && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: -100000,
            top: 0,
            width: renderFormat === 'story' ? 1080 : 1080,
            pointerEvents: 'none',
          }}
        >
          {renderFormat === 'square' ? (
            <PlacardSquare placard={placard} innerRef={captureRef} />
          ) : (
            <PlacardStory placard={placard} innerRef={captureRef} />
          )}
        </div>
      )}
    </article>
  )
}
