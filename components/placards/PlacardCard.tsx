'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, Download, Flame, MessageCircle, Send, Share2, Wand2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { PLACARD_CATEGORY_LABELS, PLACARD_LANGUAGE_LABELS } from '@/lib/placards'
import type { Placard } from '@/lib/placards'
import { PlacardSquare, PlacardStory } from './PlacardTemplate'

type Props = {
  placard: Placard
  voteCount?: number
  isVoted?: boolean
  voteEnabled?: boolean
  onVoteChange?: (delta: number, voted: boolean) => void
}

type DownloadFormat = 'square' | 'story'

const SHARE_URL_BASE = 'https://albago.org/pankartat'

function shareText(placard: Placard): string {
  const text = placard.caption?.trim() || placard.slogan
  if (text) {
    return `Pankartë në AlbaGo: "${text}" — ${SHARE_URL_BASE}`
  }
  return `Pankartë në AlbaGo — ${SHARE_URL_BASE}`
}

function remixHref(placard: Placard): string {
  const params = new URLSearchParams()
  params.set('text', placard.slogan)
  params.set('lang', placard.language)
  const allowed = placard.categories.filter(
    (c) => c !== 'short' && c !== 'powerful',
  )
  if (allowed.length > 0) params.set('categories', allowed.slice(0, 2).join(','))
  if (placard.city) params.set('city', placard.city)
  return `/pankartat/krijo?${params.toString()}`
}

function downloadFilename(placard: Placard): string {
  const ext = (placard.imageUrl?.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase()
  const safeExt = /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'jpg'
  return `albago-pankarte-${placard.id}.${safeExt}`
}

export default function PlacardCard({
  placard,
  voteCount: initialVoteCount,
  isVoted: initialIsVoted = false,
  voteEnabled = false,
  onVoteChange,
}: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState<DownloadFormat | 'photo' | null>(null)
  const [renderFormat, setRenderFormat] = useState<DownloadFormat | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [voteCount, setVoteCount] = useState(
    initialVoteCount ?? placard.voteCount ?? 0,
  )
  const [isVoted, setIsVoted] = useState(initialIsVoted)
  const [votePending, setVotePending] = useState(false)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const isPhoto = !!placard.imageUrl
  const lang = PLACARD_LANGUAGE_LABELS[placard.language]
  const visibleCategories = placard.categories
    .filter((c) => c !== 'short' && c !== 'powerful')
    .slice(0, 2)
  const isShort = placard.categories.includes('short')
  const isPowerful = placard.categories.includes('powerful')
  const displayText = placard.caption?.trim() || placard.slogan

  function flashAction(msg: string) {
    setActionMessage(msg)
    setTimeout(() => setActionMessage(null), 2200)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(displayText || SHARE_URL_BASE)
      setCopied(true)
      flashAction('U kopjua.')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      flashAction('Nuk u kopjua — provo përsëri.')
    }
  }

  async function handleDownloadPhoto() {
    if (!placard.imageUrl) return
    setDownloading('photo')
    try {
      const res = await fetch(placard.imageUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = downloadFilename(placard)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      flashAction('Fotoja u shkarkua.')
    } catch {
      flashAction('Shkarkimi dështoi.')
    } finally {
      setDownloading(null)
    }
  }

  async function handleDownloadTemplate(format: DownloadFormat) {
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
    const url = `https://t.me/share/url?url=${encodeURIComponent(SHARE_URL_BASE)}&text=${encodeURIComponent(shareText(placard))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleVote() {
    if (!voteEnabled) {
      flashAction('Pëlqimet do të vihen në funksion pasi databaza të aktivizohet.')
      return
    }
    if (votePending) return
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      router.push('/sign-in?next=/pankartat')
      return
    }
    setVotePending(true)
    const wasVoted = isVoted
    const nextVoted = !wasVoted
    const delta = nextVoted ? 1 : -1
    setIsVoted(nextVoted)
    setVoteCount((c) => Math.max(0, c + delta))
    onVoteChange?.(delta, nextVoted)

    try {
      if (nextVoted) {
        const { error } = await supabase.from('placard_votes').insert({
          user_id: user.id,
          placard_id: placard.id,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('placard_votes')
          .delete()
          .eq('user_id', user.id)
          .eq('placard_id', placard.id)
        if (error) throw error
      }
    } catch {
      setIsVoted(wasVoted)
      setVoteCount((c) => Math.max(0, c - delta))
      onVoteChange?.(-delta, wasVoted)
      flashAction('Pëlqimi dështoi.')
    } finally {
      setVotePending(false)
    }
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
      {isPhoto ? (
        <div
          className="relative aspect-square overflow-hidden bg-black/40"
        >
          <Image
            src={placard.imageUrl!}
            alt={displayText || 'Pankartë e ngarkuar nga komuniteti'}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
          {placard.city && (
            <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/85 backdrop-blur">
              {placard.city}
            </div>
          )}
          {lang && (
            <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white/85 backdrop-blur">
              {lang.flag}
            </div>
          )}
        </div>
      ) : (
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
      )}

      <div className="flex flex-col gap-4 p-5">
        {isPhoto && displayText ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-white/85">
            {displayText}
          </p>
        ) : null}

        {(visibleCategories.length > 0 || isPowerful || isShort || placard.submitterName) && (
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
            {isPhoto && placard.submitterName && (
              <span className="text-[11px] text-white/55">
                · nga {placard.submitterName}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleVote}
            disabled={votePending}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50',
              isVoted
                ? 'border-flame-500/55 bg-flame-500/15 text-flame-100'
                : 'border-white/15 bg-white/[0.04] text-white/85 hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100',
            ].join(' ')}
            title={isVoted ? 'Hiq pëlqimin' : 'Pëlqe'}
          >
            <Flame className={['h-3.5 w-3.5', isVoted ? 'text-flame-300' : ''].join(' ')} />
            <span>{isVoted ? 'Pëlqyer' : 'Pëlqe'}</span>
            <span className="rounded-full bg-white/10 px-1.5 py-0 text-[10px] font-bold text-white/85 tabular-nums">
              {voteCount}
            </span>
          </button>

          {isPhoto ? (
            <button
              type="button"
              onClick={handleDownloadPhoto}
              disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === 'photo' ? 'Duke shkarkuar…' : 'Shkarko'}
            </button>
          ) : (
            <>
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
                onClick={() => handleDownloadTemplate('square')}
                disabled={downloading !== null}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {downloading === 'square' ? 'Duke shkarkuar…' : 'Post 1:1'}
              </button>

              <button
                type="button"
                onClick={() => handleDownloadTemplate('story')}
                disabled={downloading !== null}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {downloading === 'story' ? 'Duke shkarkuar…' : 'Story 9:16'}
              </button>
            </>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {!isPhoto && (
              <Link
                href={remixHref(placard)}
                aria-label="Remix në editor"
                title="Hap në editor"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/80 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100"
              >
                <Wand2 className="h-3.5 w-3.5" />
              </Link>
            )}
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

      {/* Off-screen render target for html-to-image (legacy slogan-only rows). */}
      {!isPhoto && renderFormat && (
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
