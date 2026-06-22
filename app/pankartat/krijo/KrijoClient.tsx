'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2, Send, Square as SquareIcon, Smartphone } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { PlacardSquare, PlacardStory } from '@/components/placards/PlacardTemplate'
import PlacardSubmitModal from '@/components/placards/PlacardSubmitModal'
import {
  PLACARD_CATEGORY_LABELS,
  PLACARD_LANGUAGE_LABELS,
  PLACARD_SUBMIT_CATEGORY_KEYS,
  SLOGAN_MAX_LENGTH,
  SLOGAN_MIN_LENGTH,
} from '@/lib/placards'
import type { Placard, PlacardCategory, PlacardLanguage } from '@/lib/placards'

type Props = { submitEnabled: boolean }

type Format = 'square' | 'story'

const PLACEHOLDER = 'Mesazhi yt këtu'

export default function KrijoClient({ submitEnabled }: Props) {
  const [slogan, setSlogan] = useState('')
  const [language, setLanguage] = useState<PlacardLanguage>('sq')
  const [categories, setCategories] = useState<PlacardCategory[]>([])
  const [city, setCity] = useState('')
  const [previewFormat, setPreviewFormat] = useState<Format>('square')
  const [downloading, setDownloading] = useState<Format | null>(null)
  const [renderFormat, setRenderFormat] = useState<Format | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const trimmed = slogan.trim()
  const isValidLength = trimmed.length >= SLOGAN_MIN_LENGTH && trimmed.length <= SLOGAN_MAX_LENGTH

  const previewPlacard: Placard = {
    id: 'draft',
    slogan: trimmed.length > 0 ? trimmed : PLACEHOLDER,
    language,
    categories,
    city: city.trim() || undefined,
    submittedAt: new Date().toISOString(),
  }

  function toggleCategory(c: PlacardCategory) {
    setCategories((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c)
      if (prev.length >= 2) return prev
      return [...prev, c]
    })
  }

  function flash(msg: string) {
    setActionMessage(msg)
    setTimeout(() => setActionMessage(null), 2400)
  }

  async function handleDownload(format: Format) {
    if (!isValidLength) {
      flash(`Mesazhi duhet të jetë mes ${SLOGAN_MIN_LENGTH} dhe ${SLOGAN_MAX_LENGTH} karaktereve.`)
      return
    }
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
      const slug = (trimmed || 'pankarte')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'pankarte'
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `albago-pankarte-${slug}-${format}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      flash(format === 'square' ? 'Pankarta u shkarkua (1:1).' : 'Pankarta u shkarkua (9:16).')
    } catch {
      flash('Shkarkimi dështoi.')
    } finally {
      setRenderFormat(null)
      setDownloading(null)
    }
  }

  function handlePublish() {
    if (!isValidLength) {
      flash(`Mesazhi duhet të jetë mes ${SLOGAN_MIN_LENGTH} dhe ${SLOGAN_MAX_LENGTH} karaktereve.`)
      return
    }
    if (!submitEnabled) {
      flash('Publikimi në bibliotekë do të vihet në funksion pasi databaza të aktivizohet.')
      return
    }
    setSubmitOpen(true)
  }

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative pt-28 sm:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-radial-flame" />
        </div>

        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Link
            href="/pankartat"
            className="inline-flex items-center gap-2 text-sm text-white/65 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Kthehu te biblioteka
          </Link>

          <h1 className="display-text mt-6 text-4xl sm:text-5xl lg:text-6xl leading-[0.95] tracking-tight">
            Krijo pankartën <span className="italic text-flame-400">tënde</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-white/65">
            Shkruaj mesazhin, shih pamjen e drejtpërdrejtë, dhe shkarko pankartën në
            format për print ose për rrjetet sociale. Pa shqyrtim, pa pritje.
          </p>
        </div>
      </section>

      <section className="px-5 sm:px-8 pb-24 pt-12">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_minmax(0,_540px)]">
          {/* Form */}
          <div className="flex flex-col gap-6">
            <div>
              <label
                htmlFor="krijo-slogan"
                className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55"
              >
                Mesazhi
              </label>
              <textarea
                id="krijo-slogan"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value.slice(0, SLOGAN_MAX_LENGTH + 20))}
                rows={3}
                placeholder="P.sh. Shqipëria nuk shitet"
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-lg text-white placeholder:text-white/30 focus:border-flame-500/60 focus:outline-none"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/50">
                <span>
                  Mes {SLOGAN_MIN_LENGTH} dhe {SLOGAN_MAX_LENGTH} karaktere.
                </span>
                <span
                  className={
                    trimmed.length > SLOGAN_MAX_LENGTH ? 'text-flame-300' : 'text-white/50'
                  }
                >
                  {trimmed.length}/{SLOGAN_MAX_LENGTH}
                </span>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                Gjuha
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.entries(PLACARD_LANGUAGE_LABELS) as Array<[
                  PlacardLanguage,
                  { label: string; flag: string },
                ]>).map(([key, info]) => {
                  const active = language === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setLanguage(key)}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        active
                          ? 'border-flame-500/55 bg-flame-500/15 text-flame-100'
                          : 'border-white/10 bg-white/[0.04] text-white/70 hover:text-white',
                      ].join(' ')}
                    >
                      <span>{info.flag}</span>
                      <span>{info.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                Kategoritë <span className="text-white/35">(max 2, opsionale)</span>
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {PLACARD_SUBMIT_CATEGORY_KEYS.map((key) => {
                  const active = categories.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleCategory(key)}
                      className={[
                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        active
                          ? 'border-flame-500/55 bg-flame-500/15 text-flame-100'
                          : 'border-white/10 bg-white/[0.04] text-white/70 hover:text-white',
                      ].join(' ')}
                    >
                      {PLACARD_CATEGORY_LABELS[key]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="krijo-city"
                className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55"
              >
                Qyteti <span className="text-white/35">(opsionale)</span>
              </label>
              <input
                id="krijo-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="P.sh. Tiranë"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-flame-500/60 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload('square')}
                  disabled={downloading !== null || !isValidLength}
                  className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_-4px_rgba(238,28,37,0.55)] transition hover:bg-flame-500/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloading === 'square' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Shkarko 1:1 (Post)
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('story')}
                  disabled={downloading !== null || !isValidLength}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloading === 'story' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Shkarko 9:16 (Story)
                </button>
              </div>

              <button
                type="button"
                onClick={handlePublish}
                disabled={!isValidLength}
                title={
                  submitEnabled
                    ? 'Dërgo për moderim që të shfaqet në bibliotekë'
                    : 'Publikimi do të vihet në funksion pasi databaza të aktivizohet'
                }
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Publiko në bibliotekë
                {!submitEnabled && (
                  <span className="rounded-full bg-white/10 px-2 py-0 text-[10px] uppercase tracking-wide text-white/55">
                    Së shpejti
                  </span>
                )}
              </button>

              {actionMessage && (
                <div className="text-[12px] font-medium text-white/65">{actionMessage}</div>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                Pamja
              </span>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => setPreviewFormat('square')}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
                    previewFormat === 'square'
                      ? 'bg-flame-500/20 text-flame-100'
                      : 'text-white/65 hover:text-white',
                  ].join(' ')}
                >
                  <SquareIcon className="h-3.5 w-3.5" />
                  Post 1:1
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat('story')}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
                    previewFormat === 'story'
                      ? 'bg-flame-500/20 text-flame-100'
                      : 'text-white/65 hover:text-white',
                  ].join(' ')}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Story 9:16
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-ink-950">
              <PreviewFrame format={previewFormat} placard={previewPlacard} />
            </div>

            <p className="text-[11px] text-white/45">
              Pamja përditësohet drejtpërdrejt ndërsa shkruan. Shkarkimi krijon imazhin
              në rezolucion të plotë (1080×1080 ose 1080×1920).
            </p>
          </div>
        </div>
      </section>

      {/* Off-screen full-size render for download capture */}
      {renderFormat && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: -100000,
            top: 0,
            width: 1080,
            pointerEvents: 'none',
          }}
        >
          {renderFormat === 'square' ? (
            <PlacardSquare placard={previewPlacard} innerRef={captureRef} />
          ) : (
            <PlacardStory placard={previewPlacard} innerRef={captureRef} />
          )}
        </div>
      )}

      <PlacardSubmitModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        initialSlogan={slogan}
        initialLanguage={language}
        initialCategories={categories}
        initialCity={city}
      />
    </div>
  )
}

const CANVAS_W = 1080
const CANVAS_H_SQUARE = 1080
const CANVAS_H_STORY = 1920

function PreviewFrame({ format, placard }: { format: Format; placard: Placard }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.4)
  const canvasH = format === 'square' ? CANVAS_H_SQUARE : CANVAS_H_STORY

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const apply = () => setScale(el.clientWidth / CANVAS_W)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [format])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        aspectRatio: `${CANVAS_W} / ${canvasH}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: CANVAS_W,
          height: canvasH,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {format === 'square' ? (
          <PlacardSquare placard={placard} />
        ) : (
          <PlacardStory placard={placard} />
        )}
      </div>
    </div>
  )
}
