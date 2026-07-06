'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Flame,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  Megaphone,
  Users,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

type Props = {
  pageUrl: string
  pdfUrl: string
}

const GOOGLE_MAPS_HREF =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('Prinzenstraße 85, 10969 Berlin, Germany')

export default function EdiRamaBerlinClient({ pageUrl, pdfUrl }: Props) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState<string>(pageUrl)

  // Use the live origin once mounted so share links work from preview /
  // localhost too — falls back to canonical URL for the SSR pass.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(`${window.location.origin}/protests/edi-rama-berlin-2026`)
    }
  }, [])

  const caption = t('er_share_caption')
  const encodedUrl = encodeURIComponent(origin)
  const encodedCaption = encodeURIComponent(caption)
  const whatsappHref = `https://wa.me/?text=${encodedCaption}%20${encodedUrl}`
  const telegramHref = `https://t.me/share/url?url=${encodedUrl}&text=${encodedCaption}`
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodedCaption}&url=${encodedUrl}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(origin)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // ignore — older browser without clipboard API
    }
  }

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: t('er_hero_title'),
          text: caption,
          url: origin,
        })
      } catch {
        // user dismissed — no-op
      }
    } else {
      handleCopy()
    }
  }

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      {/* HERO */}
      <section className="relative overflow-hidden px-4 pb-16 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-flame-500/20 blur-3xl" />
          <div className="absolute right-[20%] top-32 h-[22rem] w-[22rem] rounded-full bg-flame-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            href="/protests"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('er_back')}
          </Link>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-flame-500/30 bg-flame-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-flame-300">
            <Flame className="h-3 w-3" />
            {t('er_eyebrow')}
          </div>

          <h1 className="display-text mt-5 text-4xl leading-[1.02] tracking-tight sm:text-6xl">
            {t('er_hero_title')}
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            {t('er_hero_subtitle')}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={GOOGLE_MAPS_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
            >
              <MapPin className="h-4 w-4" />
              {t('er_cta_directions')}
            </a>

            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
            >
              <Download className="h-4 w-4" />
              {t('er_cta_download')}
            </a>

            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
            >
              <Share2 className="h-4 w-4" />
              {t('er_cta_share')}
            </button>

            <Link
              href="/pankartat"
              className="inline-flex items-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-5 py-3 text-sm font-semibold text-flame-100 transition hover:border-flame-500/60 hover:bg-flame-500/15"
            >
              <Flame className="h-4 w-4" />
              Pankartat e Revolucionit
            </Link>
          </div>
        </div>
      </section>

      {/* CONFIRMED DETAILS */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {t('er_info_label')}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
              <div className="flex items-center gap-2 text-flame-300">
                <Calendar className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                  {t('er_info_when')}
                </p>
              </div>
              <p className="mt-3 text-lg font-semibold text-white">
                {t('er_info_when_value')}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
              <div className="flex items-center gap-2 text-flame-300">
                <MapPin className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                  {t('er_info_where')}
                </p>
              </div>
              <p className="mt-3 text-lg font-semibold text-white">
                {t('er_info_venue')}
              </p>
              <p className="mt-1 text-sm text-white/65">
                {t('er_info_address')} · {t('er_info_country')}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
            <div className="flex items-center gap-2 text-flame-300">
              <Users className="h-4 w-4" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                {t('er_info_timeline')}
              </p>
            </div>
            <ol className="mt-4 space-y-3">
              <li className="flex items-baseline gap-4">
                <span className="w-16 shrink-0 text-base font-semibold tabular-nums text-flame-300">
                  17:30
                </span>
                <span className="text-sm text-white/80">{t('er_info_t1')}</span>
              </li>
              <li className="flex items-baseline gap-4">
                <span className="w-16 shrink-0 text-base font-semibold tabular-nums text-flame-300">
                  18:30
                </span>
                <span className="text-sm text-white/80">{t('er_info_t2')}</span>
              </li>
              <li className="flex items-baseline gap-4">
                <span className="w-16 shrink-0 text-base font-semibold tabular-nums text-flame-300">
                  ≈ 19:30
                </span>
                <span className="text-sm text-white/80">
                  {t('er_info_t3')}{' '}
                  <span className="text-white/40">({t('er_info_t3_note')})</span>
                </span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* WHY WE GATHER */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {t('er_why_label')}
          </p>
          <h2 className="display-text mt-3 text-3xl leading-tight text-white sm:text-4xl">
            {t('er_why_title')}
          </h2>

          <div className="mt-6 space-y-5 text-base leading-7 text-white/75">
            <p>{t('er_why_p1')}</p>
            <p>{t('er_why_p2')}</p>
          </div>
        </div>
      </section>

      {/* OFFICIAL PROGRAM */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {t('er_program_label')}
          </p>
          <h2 className="display-text mt-3 text-3xl leading-tight text-white sm:text-4xl">
            {t('er_program_title')}
          </h2>
          <p className="mt-6 text-base leading-7 text-white/75">
            {t('er_program_body')}
          </p>
          <p className="mt-4 text-sm italic text-white/50">
            “{t('er_program_event_name')}”
          </p>
        </div>
      </section>

      {/* DOWNLOAD */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {t('er_download_label')}
          </p>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-flame-500/30 bg-flame-500/10">
                  <FileText className="h-6 w-6 text-flame-300" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">
                    {t('er_download_title')}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/65">
                    {t('er_download_body')}
                  </p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-white/40">
                    {t('er_download_meta')}
                  </p>
                </div>
              </div>

              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5 sm:self-auto"
              >
                <Download className="h-4 w-4" />
                {t('er_download_cta')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SHARE */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {t('er_share_label')}
          </p>
          <h2 className="display-text mt-3 text-3xl leading-tight text-white sm:text-4xl">
            {t('er_share_title')}
          </h2>
          <p className="mt-4 text-base leading-7 text-white/75">
            {t('er_share_body')}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              <MessageCircle className="h-4 w-4" />
              {t('er_share_whatsapp')}
            </a>

            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              <Send className="h-4 w-4" />
              {t('er_share_telegram')}
            </a>

            <a
              href={facebookHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
            >
              <ExternalLink className="h-4 w-4" />
              {t('er_share_facebook')}
            </a>

            <a
              href={twitterHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
            >
              <Megaphone className="h-4 w-4" />
              {t('er_share_x')}
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  {t('er_share_copied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t('er_share_copy')}
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
