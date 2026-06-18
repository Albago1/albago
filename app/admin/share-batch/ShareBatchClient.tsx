'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Calendar, Download, Image as ImageIcon, Loader2, MapPin, Package } from 'lucide-react'
import type { ShareEventData } from '@/lib/share/types'
import { buildCaption } from '@/lib/share/captions'
import { generateQrDataUrl } from '@/lib/share/qr'
import StoryShareTemplate from '@/components/share/templates/StoryShareTemplate'
import SquareShareTemplate from '@/components/share/templates/SquareShareTemplate'

type Props = {
  protests: ShareEventData[]
}

function safeFilename(slug: string, fallback: string): string {
  const base = (slug || fallback).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return base || fallback
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ShareBatchClient({ protests }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneFilename, setDoneFilename] = useState<string | null>(null)

  const storyRef = useRef<HTMLDivElement | null>(null)
  const squareRef = useRef<HTMLDivElement | null>(null)

  const placeholder: ShareEventData = useMemo(
    () => ({
      title: '—',
      slug: 'placeholder',
      category: 'civic',
      city: '—',
      country: null,
      address: null,
      date: '2026-01-01',
      time: null,
      endTime: null,
      organizerName: null,
      isCivic: true,
      eventUrl: 'https://albago.org',
    }),
    [],
  )

  const currentData = activeIndex == null ? placeholder : protests[activeIndex] ?? placeholder

  const generateBatch = useCallback(async () => {
    if (protests.length === 0) return
    setError(null)
    setDoneFilename(null)
    setWorking(true)
    setProgress({ done: 0, total: protests.length })
    try {
      const [{ default: JSZip }, htmlToImage] = await Promise.all([
        import('jszip'),
        import('html-to-image'),
      ])
      const zip = new JSZip()
      const reelsDir = zip.folder('reels')
      const postsDir = zip.folder('posts')
      const captionsDir = zip.folder('captions')
      if (!reelsDir || !postsDir || !captionsDir) {
        throw new Error('Could not initialise ZIP folders')
      }

      const manifestLines: string[] = []

      for (let i = 0; i < protests.length; i++) {
        const ev = protests[i]
        const qr = await generateQrDataUrl(ev.eventUrl)
        setQrDataUrl(qr)
        setActiveIndex(i)

        // Wait for React to commit + paint with the new event data.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        await new Promise((resolve) => setTimeout(resolve, 60))

        const storyNode = storyRef.current
        const squareNode = squareRef.current
        if (!storyNode || !squareNode) throw new Error('Template nodes not mounted')

        const storyPng = await htmlToImage.toPng(storyNode, {
          pixelRatio: 1,
          cacheBust: true,
          backgroundColor: '#050505',
        })
        const squarePng = await htmlToImage.toPng(squareNode, {
          pixelRatio: 1,
          cacheBust: true,
          backgroundColor: '#050505',
        })

        const filename = safeFilename(ev.slug, `event-${i + 1}`)
        const dated = `${ev.date}-${filename}`

        reelsDir.file(`${dated}.png`, storyPng.split(',')[1], { base64: true })
        postsDir.file(`${dated}.png`, squarePng.split(',')[1], { base64: true })
        captionsDir.file(`${dated}.txt`, buildCaption(ev))

        manifestLines.push(
          `${ev.date} · ${ev.time ?? '—'} · ${ev.city}${ev.country ? `, ${ev.country}` : ''} · ${ev.title}`,
        )

        setProgress({ done: i + 1, total: protests.length })
      }

      zip.file(
        'README.txt',
        [
          'AlbaGo — Protest share batch',
          `Generated: ${new Date().toISOString()}`,
          `Events: ${protests.length}`,
          '',
          'Folders:',
          '  reels/     1080x1920 PNGs for Instagram Story, TikTok, Reels.',
          '  posts/     1080x1080 PNGs for Instagram / Facebook feed.',
          '  captions/  Ready-to-paste Albanian captions per event.',
          '',
          'Filename convention:',
          '  {date}-{slug}.png — easy to scan and sort chronologically.',
          '',
          'Manifest:',
          ...manifestLines.map((l) => `  ${l}`),
        ].join('\n'),
      )

      const blob = await zip.generateAsync({ type: 'blob' })
      const stamp = new Date().toISOString().slice(0, 10)
      const filename = `albago-protests-${stamp}.zip`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)

      setDoneFilename(filename)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setWorking(false)
      setActiveIndex(null)
      setQrDataUrl(null)
    }
  }, [protests])

  return (
    <>
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Found
            </p>
            <p className="mt-1 text-3xl font-semibold text-white">{protests.length}</p>
            <p className="text-xs text-white/55">
              upcoming protest{protests.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={generateBatch}
            disabled={working || protests.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-6 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress ? `Rendering ${progress.done} / ${progress.total}` : 'Working…'}
              </>
            ) : (
              <>
                <Package className="h-4 w-4" />
                Generate ZIP
              </>
            )}
          </button>
        </div>

        {working && progress && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-flame-500 transition-[width] duration-300"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/55">
              Currently rendering:{' '}
              <span className="text-white/85">
                {activeIndex != null ? protests[activeIndex]?.title : '—'}
              </span>
            </p>
          </div>
        )}

        {doneFilename && !working && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div>
              <p>
                Saved <span className="font-semibold">{doneFilename}</span> to your Downloads
                folder.
              </p>
              <p className="mt-1 text-[12px] text-emerald-200/80">
                Extract it — you&apos;ll find reels / posts / captions folders inside, named
                by date so they sort cleanly.
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-2xl border border-flame-500/30 bg-flame-500/[0.08] px-4 py-3 text-sm text-flame-200">
            {error}
          </p>
        )}
      </div>

      {protests.length > 0 && (
        <div className="mt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            What will be packaged
          </p>
          <div className="mt-3 grid gap-2">
            {protests.map((p) => (
              <div
                key={p.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{p.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateShort(p.date)}
                      {p.time ? ` · ${p.time}` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {p.city}
                      {p.country ? `, ${p.country}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                  <ImageIcon className="h-3 w-3" />
                  reel + post + caption
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {protests.length === 0 && !error && (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          No upcoming civic events found. Add events with is_civic = true and a future date,
          then refresh.
        </p>
      )}

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
        <StoryShareTemplate data={currentData} qrDataUrl={qrDataUrl} innerRef={storyRef} />
        <SquareShareTemplate data={currentData} qrDataUrl={qrDataUrl} innerRef={squareRef} />
      </div>
    </>
  )
}
