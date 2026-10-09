'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink, Link2, Share2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { trackInteraction, type TrackType } from '@/lib/track'
import type { Availability, AvailabilityLevel } from '@/lib/hysa/availability'
import { HYSA_LANGS, hysaPath, OFFICIAL_SHOP_URL, type CategoryId, type HysaLang } from '@/lib/hysa/event'

// Client islands of the Team Hysa page (phase 44): tracking, countdown,
// share, language switch, sticky ticket bar and availability status. The
// page itself is server-rendered; these stay small.

const CAMPAIGN = 'hysa'

function track(type: TrackType, lang: HysaLang, meta: Record<string, unknown> = {}, extra: { platform?: string; dedupeKey?: string } = {}) {
  trackInteraction(type, {
    platform: extra.platform ?? null,
    dedupeKey: extra.dedupeKey,
    meta: { campaign: CAMPAIGN, lang, ...meta },
  })
}

/** page_view once per tab per language page. */
export function PageView({ lang }: { lang: HysaLang }) {
  useEffect(() => {
    track('page_view', lang)
  }, [lang])
  return null
}

type OutboundType = 'official_shop_click' | 'ticket_category_click' | 'seat_map_click' | 'group_ticket_click'

/** A link into the official ticket shop that records the click first. */
export function OfficialLink({
  type,
  lang,
  category,
  placement,
  className,
  children,
}: {
  type: OutboundType
  lang: HysaLang
  category?: CategoryId
  placement: string
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={OFFICIAL_SHOP_URL}
      target="_blank"
      // No "noreferrer": the official shop should see the visits came from AlbaGo.
      rel="noopener"
      className={className}
      onClick={() => track(type, lang, { category: category ?? null, placement, outbound: true })}
    >
      {children}
      <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-80" aria-hidden />
    </a>
  )
}

/** Fires ticket_category_view when a category card is half visible (once per tab). */
export function CategoryView({ lang, category, children, className }: { lang: HysaLang; category: CategoryId; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track('ticket_category_view', lang, { category }, { dedupeKey: `hysa:${lang}:${category}` })
          io.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lang, category])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

/** Countdown to fight day. Renders dashes until mounted (no hydration mismatch). */
export function Countdown({ to, labels, fightDay }: { to: string; labels: { d: string; h: string; m: string; s: string }; fightDay: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [])
  const target = new Date(to).getTime()
  const left = now === null ? null : Math.max(0, target - now)
  if (left === 0) {
    return <p className="text-sm font-semibold text-flame-200">{fightDay}</p>
  }
  const parts =
    left === null
      ? null
      : [
          Math.floor(left / 86_400_000),
          Math.floor(left / 3_600_000) % 24,
          Math.floor(left / 60_000) % 60,
          Math.floor(left / 1000) % 60,
        ]
  const units = [labels.d, labels.h, labels.m, labels.s]
  return (
    <div className="flex gap-2 sm:gap-3" role="timer" aria-live="off">
      {units.map((u, i) => (
        <div key={u} className="flex min-w-[64px] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur sm:min-w-[78px]">
          <span className="font-display text-3xl tabular-nums leading-none text-white sm:text-4xl">
            {parts ? String(parts[i]).padStart(i === 0 ? 1 : 2, '0') : '–'}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">{u}</span>
        </div>
      ))}
    </div>
  )
}

/** SHQIP / DE / EN — navigates to the language page and aligns the app language. */
export function LanguageSwitch({ lang, label }: { lang: HysaLang; label: string }) {
  const { setLanguage } = useLanguage()
  const flags: Record<HysaLang, { flag: string; name: string }> = {
    sq: { flag: '🇦🇱', name: 'SHQIP' },
    de: { flag: '🇩🇪', name: 'DE' },
    en: { flag: '🇬🇧', name: 'EN' },
  }
  return (
    <nav aria-label={label} className="flex items-center gap-1 rounded-full border border-white/10 bg-ink-950/70 p-1 backdrop-blur">
      {HYSA_LANGS.map((l) => (
        <Link
          key={l}
          href={hysaPath(l)}
          hrefLang={l}
          aria-current={l === lang ? 'page' : undefined}
          onClick={() => {
            if (l === lang) return
            track('language_changed', lang, { from: lang, to: l })
            setLanguage(l)
          }}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold tracking-wide transition ${
            l === lang ? 'bg-white text-ink-950' : 'text-white/70 hover:text-white'
          }`}
        >
          <span aria-hidden>{flags[l].flag}</span>
          {flags[l].name}
        </Link>
      ))}
    </nav>
  )
}

/** WhatsApp / Facebook / copy link, plus the native share sheet on phones. */
export function ShareButtons({
  lang,
  pageUrl,
  labels,
}: {
  lang: HysaLang
  pageUrl: string
  labels: { share: string; shareText: string; whatsapp: string; facebook: string; copy: string; copied: string }
}) {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), 0)
    return () => window.clearTimeout(id)
  }, [])

  const urlFor = (source: string) =>
    `${pageUrl}?utm_source=${source}&utm_medium=share&utm_campaign=kabayel_hysa`
  const wa = `https://wa.me/?text=${encodeURIComponent(`${labels.shareText} ${urlFor('whatsapp')}`)}`
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlFor('facebook'))}`
  const btn =
    'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/[0.09]'

  return (
    <div className="flex flex-col gap-3">
      {canShare && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.share({ text: labels.shareText, url: urlFor('native_share') })
              trackInteraction('share_click', { platform: 'native', meta: { campaign: CAMPAIGN, lang } })
            } catch {
              /* dismissed */
            }
          }}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-flame-500 px-6 text-sm font-bold tracking-wide text-white shadow-glow-flame transition hover:bg-flame-400"
        >
          <Share2 className="h-4 w-4" />
          {labels.share}
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <a href={wa} target="_blank" rel="noopener noreferrer" className={btn} onClick={() => track('share_whatsapp', lang, {}, { platform: 'whatsapp' })}>
          {labels.whatsapp}
        </a>
        <a href={fb} target="_blank" rel="noopener noreferrer" className={btn} onClick={() => track('share_facebook', lang, {}, { platform: 'facebook' })}>
          {labels.facebook}
        </a>
        <button
          type="button"
          className={`${btn} col-span-2`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(urlFor('copy_link'))
              setCopied(true)
              window.setTimeout(() => setCopied(false), 2200)
            } catch {
              /* clipboard blocked */
            }
            track('share_copy_link', lang, {}, { platform: 'copy' })
          }}
        >
          <Link2 className="h-4 w-4" />
          <span className="truncate">{copied ? labels.copied : labels.copy}</span>
        </button>
      </div>
    </div>
  )
}

/** Phone-only ticket bar, shown once the hero's own buttons scroll away. */
export function StickyTicketBar({ label, targetId, watchId }: { label: string; targetId: string; watchId: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = document.getElementById(watchId)
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [watchId])
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition duration-300 sm:hidden ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      }`}
    >
      <a
        href={`#${targetId}`}
        className="flex h-14 w-full items-center justify-center rounded-full bg-flame-500 text-[15px] font-bold tracking-wide text-white shadow-[0_12px_40px_-8px_rgba(238,28,37,0.8)]"
      >
        {label}
      </a>
    </div>
  )
}

const MAX_LIVE_AGE_MS = 3 * 60_000

const LEVEL_STYLE: Record<AvailabilityLevel, string> = {
  available: 'bg-emerald-400',
  limited: 'bg-amber-400',
  sold_out: 'bg-white/30',
  unknown: 'bg-white/30',
}

/** Live status from /api/events/kabayel-hysa/availability — "live" only when it is. */
export function AvailabilityStatus({
  lang,
  labels,
}: {
  lang: HysaLang
  labels: {
    checking: string
    official: string
    failed: string
    checkOfficial: string
    live: string
    updated: string
    stale: string
    status: Record<AvailabilityLevel, string>
  }
}) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; data: Availability; fresh: boolean }>({ kind: 'loading' })
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 8000)
    // no-store: never show a browser-cached answer as current.
    fetch('/api/events/kabayel-hysa/availability', { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Availability>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        // "LIVE" only for fresh data; anything older is labelled not current.
        const fresh =
          data.status === 'live' && !!data.lastUpdated && Date.now() - new Date(data.lastUpdated).getTime() < MAX_LIVE_AGE_MS
        if (!cancelled) setState({ kind: 'ok', data, fresh })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })
      .finally(() => window.clearTimeout(timer))
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const box = 'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm'
  if (state.kind === 'loading') return <p className={`${box} text-white/50`}>{labels.checking}</p>

  const data = state.kind === 'ok' ? state.data : null
  if (!data || data.status === 'unavailable') {
    return (
      <div className={`${box} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <p className="text-white/70">{labels.failed}</p>
        <OfficialLink
          type="official_shop_click"
          lang={lang}
          placement="availability_failed"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/20 px-4 text-xs font-bold tracking-wide text-white hover:bg-white/10"
        >
          {labels.checkOfficial}
        </OfficialLink>
      </div>
    )
  }
  if (data.status === 'not_configured') {
    return (
      <p className={`${box} flex items-center gap-2 text-white/70`}>
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-white/40" aria-hidden />
        {labels.official}
      </p>
    )
  }
  const fresh = state.kind === 'ok' && state.fresh
  const time = data.lastUpdated
    ? new Date(data.lastUpdated).toLocaleTimeString(lang === 'sq' ? 'sq-AL' : lang === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <div className={box}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {fresh && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            {labels.live}
          </span>
        )}
        {data.categories.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 text-white/80">
            <span className={`h-2 w-2 rounded-full ${LEVEL_STYLE[c.availability]}`} aria-hidden />
            <span className="font-semibold">{c.name}</span>
            {c.price !== null && <span className="text-white">€{c.price}</span>}
            <span className="text-white/55">{labels.status[c.availability]}</span>
          </span>
        ))}
      </div>
      {time && (
        <p className="mt-2 text-[11px] text-white/45">
          {labels.updated}: {time}
          {!fresh ? ` · ${labels.stale}` : ''}
        </p>
      )}
    </div>
  )
}
