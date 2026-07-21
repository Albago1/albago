'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Package,
  RefreshCw,
  Shuffle,
  Smartphone,
  Sparkles,
  Video,
  X,
} from 'lucide-react'
import type { ShareEventData } from '@/lib/share/types'
import type { ReelMotion } from '@/lib/share/recordPosterVideo'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { trackInteraction } from '@/lib/track'
import { buildCaption } from '@/lib/share/captions'
import { generateQrDataUrl } from '@/lib/share/qr'
import StoryShareTemplate from '@/components/share/templates/StoryShareTemplate'
import SquareShareTemplate from '@/components/share/templates/SquareShareTemplate'
import FacebookShareTemplate from '@/components/share/templates/FacebookShareTemplate'

/**
 * AlbaGo Studio client — the whole creation experience.
 *
 * Principles (the reasons the old flow felt broken, inverted):
 *   1. WYSIWYG. The poster is rendered live and visible; what you see is the
 *      exact node that gets captured. "Create" can never produce "nothing".
 *   2. No blank states. The kit builds itself on entry (reveal sequence tied
 *      to real work, not fake progress) and lands on a finished poster.
 *   3. Taste controls, not tools. Looks restyle every format coherently;
 *      Shuffle riffs inside the brand; photos are picked, not cropped;
 *      captions arrive written.
 *   4. Loud feedback. Every action ends in a visible toast — shared, copied,
 *      saved — never a silent download.
 *   5. Nothing is lost. Look, format, photo and edited captions persist per
 *      event, so closing the tab never throws work away.
 */

type Props = {
  data: ShareEventData
  /** Event photos, banner first, deduped, https only. */
  images: string[]
}

type Look = 'cinematic' | 'photo' | 'noir' | 'ink' | 'ai'
type Format = 'story' | 'square' | 'card'
type Lang = 'en' | 'sq' | 'de' | 'es'
type CaptionPack = Record<Lang, string>

type Draft = {
  look?: Look
  photoIdx?: number
  format?: Format
  motion?: ReelMotion
  captionLang?: Lang
  seed?: number
  captions?: Partial<Record<Lang, string>>
}

const FORMAT_DIMS: Record<Format, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: 'Story' },
  square: { w: 1080, h: 1080, label: 'Post' },
  card: { w: 1200, h: 630, label: 'Card' },
}

const LANGS: Lang[] = ['sq', 'en', 'de', 'es']
const MOTIONS: ReelMotion[] = ['drift', 'pulse', 'sweep']
const GRADED_LOOKS: ReadonlyArray<Look> = ['cinematic', 'noir', 'ai']

function draftKey(slug: string): string {
  return `albago:studio:draft:${slug}`
}

export default function StudioClient({ data, images }: Props) {
  const { t, language } = useLanguage()
  const hasPhotos = images.length > 0

  // ---- creative state --------------------------------------------------
  const [look, setLook] = useState<Look>(hasPhotos ? 'cinematic' : 'ink')
  const [photoIdx, setPhotoIdx] = useState(0)
  const [format, setFormat] = useState<Format>('story')
  const [seed, setSeed] = useState(0)
  const [motion, setMotion] = useState<ReelMotion>('drift')
  const [backdrop, setBackdrop] = useState<string | null>(null)
  const [backdropLoading, setBackdropLoading] = useState(false)
  const [aiBackdrop, setAiBackdrop] = useState<string | null>(null)
  const [aiPainting, setAiPainting] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Grade cache (look:photo:seed) so revisiting a combination is instant.
  const gradeCache = useRef(new Map<string, string>())

  // ---- captions --------------------------------------------------------
  const fallbackCaption = useMemo(() => buildCaption(data), [data])
  const [captions, setCaptions] = useState<CaptionPack>({
    en: fallbackCaption,
    sq: fallbackCaption,
    de: fallbackCaption,
    es: fallbackCaption,
  })
  const [captionLang, setCaptionLang] = useState<Lang>(
    (LANGS as string[]).includes(language) ? (language as Lang) : 'en',
  )
  const [captionsDone, setCaptionsDone] = useState(false)
  // Languages the user has touched — the AI response never overwrites these,
  // and only these are persisted in the draft.
  const editedLangs = useRef(new Set<Lang>())

  // ---- action state ----------------------------------------------------
  const [busy, setBusy] = useState<'share' | 'download' | 'kit' | null>(null)
  const [recording, setRecording] = useState<15 | 30 | null>(null)
  const [recordProgress, setRecordProgress] = useState(0)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- reveal ----------------------------------------------------------
  const [revealDone, setRevealDone] = useState(false)
  const [steps, setSteps] = useState({ read: false, art: false, type: false })
  const [draftReady, setDraftReady] = useState(false)

  const showToast = useCallback((msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, ok })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  // Studio actions ride the existing share_click type with a studio_* platform
  // string (same convention the share modal used for its poster actions).
  const track = useCallback(
    (action: string, meta?: Record<string, unknown>) => {
      trackInteraction('share_click', {
        entityType: 'event',
        platform: action,
        city: data.city,
        country: data.country,
        meta: { slug: data.slug, civic: data.isCivic, ...meta },
      })
    },
    [data.city, data.country, data.slug, data.isCivic],
  )

  // ---- backdrop resolution --------------------------------------------
  const resolveBackdrop = useCallback(
    async (nextLook: Look, idx: number, seedVal: number): Promise<string | null> => {
      if (nextLook === 'ink') return null
      if (nextLook === 'ai') {
        // Raw flux output is never shown — it always passes through the same
        // brand grade as the Cinematic look. The duotone crushes the cheap
        // AI palette and the grain hides its artifacts; Shuffle re-seeds it.
        if (!aiBackdrop) return null
        const key = `ai:${seedVal}`
        const hit = gradeCache.current.get(key)
        if (hit) return hit
        const mod = await import('@/lib/share/gradeBackdrop')
        const url = await mod.gradeBackdrop(aiBackdrop, { variant: 'flame', seed: seedVal })
        gradeCache.current.set(key, url)
        return url
      }
      const key = `${nextLook}:${idx}:${nextLook === 'photo' ? 0 : seedVal}`
      const hit = gradeCache.current.get(key)
      if (hit) return hit
      const src = images[idx]
      if (!src) return null
      const mod = await import('@/lib/share/gradeBackdrop')
      const url =
        nextLook === 'photo'
          ? await mod.imageToDataUrl(src)
          : await mod.gradeBackdrop(src, {
              variant: nextLook === 'noir' ? 'noir' : 'flame',
              seed: seedVal,
            })
      gradeCache.current.set(key, url)
      return url
    },
    [images, aiBackdrop],
  )

  const applyLook = useCallback(
    async (nextLook: Look, idx = photoIdx, seedVal = seed) => {
      setBackdropLoading(true)
      try {
        const url = await resolveBackdrop(nextLook, idx, seedVal)
        setBackdrop(url)
        setLook(nextLook)
        setPhotoIdx(idx)
        setSeed(seedVal)
      } catch (e) {
        console.error('studio backdrop failed:', e)
        showToast(t('share_ai_error'), false)
      } finally {
        setBackdropLoading(false)
      }
    },
    [photoIdx, seed, resolveBackdrop, showToast, t],
  )

  // Shuffle — a new seeded riff on the current grade: bloom placement,
  // depth and vignette move inside art-directed bounds. Always on brand.
  const handleShuffle = useCallback(() => {
    if (backdropLoading) return
    const s = Math.max(1, (Math.random() * 0x7fffffff) | 0)
    track('studio_shuffle', { look })
    applyLook(look, photoIdx, s)
  }, [applyLook, backdropLoading, look, photoIdx, track])

  // AI look: generate on first use, then cached (server caches per event too).
  // The raw render is only ever an ingredient — it is brand-graded before it
  // touches the poster, exactly like an event photo.
  const paintAi = useCallback(
    async (regenerate = false) => {
      setAiPainting(true)
      try {
        const res = await fetch('/api/ai-poster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: data.slug, regenerate }),
        })
        const json = (await res.json()) as { ok: boolean; url?: string }
        if (!res.ok || !json.ok || !json.url) throw new Error('generation failed')
        const blob = await (await fetch(json.url, { cache: 'no-store' })).blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('read failed'))
          reader.readAsDataURL(blob)
        })
        const mod = await import('@/lib/share/gradeBackdrop')
        const graded = await mod.gradeBackdrop(dataUrl, { variant: 'flame', seed })
        // Fresh artwork invalidates every grade of the previous one.
        for (const k of [...gradeCache.current.keys()]) {
          if (k.startsWith('ai:')) gradeCache.current.delete(k)
        }
        gradeCache.current.set(`ai:${seed}`, graded)
        setAiBackdrop(dataUrl)
        setBackdrop(graded)
        setLook('ai')
        track('studio_look', { look: 'ai', regenerate })
      } catch (e) {
        console.error('studio ai paint failed:', e)
        showToast(t('share_ai_error'), false)
      } finally {
        setAiPainting(false)
      }
    },
    [data.slug, seed, showToast, t, track],
  )

  // ---- entry: restore the draft, build the kit (reveal tied to real work) --
  useEffect(() => {
    let cancelled = false
    track('studio_open')
    const started = Date.now()
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const minShow = reduced ? 0 : 2200

    // Last session's work comes back exactly as it was left. The AI look is
    // never auto-restored (it would fire a generation on entry).
    let draft: Draft | null = null
    try {
      draft = JSON.parse(localStorage.getItem(draftKey(data.slug)) ?? 'null') as Draft | null
    } catch {
      draft = null
    }
    const defaultLook: Look = hasPhotos ? 'cinematic' : 'ink'
    let startLook = draft?.look && draft.look !== 'ai' ? draft.look : defaultLook
    if (!hasPhotos && startLook !== 'ink') startLook = 'ink'
    const startIdx = Math.min(Math.max(draft?.photoIdx ?? 0, 0), Math.max(images.length - 1, 0))
    const startSeed = draft?.seed ?? 0
    if (draft?.format && draft.format in FORMAT_DIMS) setFormat(draft.format)
    if (draft?.motion && (MOTIONS as string[]).includes(draft.motion)) setMotion(draft.motion)
    if (draft?.captionLang && (LANGS as string[]).includes(draft.captionLang)) {
      setCaptionLang(draft.captionLang)
    }
    if (draft?.captions) {
      const restored: Partial<Record<Lang, string>> = {}
      for (const l of LANGS) {
        const v = draft.captions[l]
        if (typeof v === 'string' && v.trim()) {
          restored[l] = v
          editedLangs.current.add(l)
        }
      }
      if (Object.keys(restored).length > 0) setCaptions((c) => ({ ...c, ...restored }))
    }
    setLook(startLook)
    setPhotoIdx(startIdx)
    setSeed(startSeed)
    setDraftReady(true)

    setTimeout(() => !cancelled && setSteps((s) => ({ ...s, read: true })), reduced ? 0 : 450)

    const artwork = resolveBackdrop(startLook, startIdx, startSeed)
      .then((url) => {
        if (!cancelled) setBackdrop(url)
      })
      .catch((e) => console.error('studio initial backdrop failed:', e))
      .finally(() => !cancelled && setSteps((s) => ({ ...s, art: true })))

    // Ref-tagged QR — so analytics can attribute scans to Studio posters.
    const qr = generateQrDataUrl(`${data.eventUrl}?ref=studio`)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {})
      .finally(() => !cancelled && setSteps((s) => ({ ...s, type: true })))

    // Captions load independently — the overlay never waits on the network's
    // slowest call; the template caption is already in place as fallback.
    fetch('/api/ai-caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: data.slug }),
    })
      .then((res) => res.json())
      .then((json: { ok: boolean; captions?: CaptionPack }) => {
        if (cancelled || !json.ok || !json.captions) return
        const fresh = json.captions
        // Never clobber what the user (or the restored draft) already wrote.
        setCaptions((c) => {
          const next = { ...c }
          for (const l of LANGS) {
            if (!editedLangs.current.has(l) && fresh[l]) next[l] = fresh[l]
          }
          return next
        })
      })
      .catch(() => {})
      .finally(() => !cancelled && setCaptionsDone(true))

    Promise.allSettled([artwork, qr]).then(() => {
      const wait = Math.max(0, minShow - (Date.now() - started))
      setTimeout(() => !cancelled && setRevealDone(true), wait)
    })

    return () => {
      cancelled = true
    }
    // Entry sequence runs exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- draft persistence (debounced; only after the restore has applied) --
  useEffect(() => {
    if (!draftReady) return
    const id = setTimeout(() => {
      const edited: Partial<Record<Lang, string>> = {}
      editedLangs.current.forEach((l) => {
        edited[l] = captions[l]
      })
      const draft: Draft = {
        look,
        photoIdx,
        format,
        motion,
        captionLang,
        seed,
        ...(Object.keys(edited).length > 0 ? { captions: edited } : {}),
      }
      try {
        localStorage.setItem(draftKey(data.slug), JSON.stringify(draft))
      } catch {
        // Quota/private mode — persistence is a nicety, never an error.
      }
    }, 400)
    return () => clearTimeout(id)
  }, [draftReady, look, photoIdx, format, motion, captionLang, seed, captions, data.slug])

  // ---- capture & actions ----------------------------------------------
  const storyRef = useRef<HTMLDivElement | null>(null)
  const squareRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const activeNode = useCallback((): HTMLElement | null => {
    return format === 'story'
      ? storyRef.current
      : format === 'square'
        ? squareRef.current
        : cardRef.current
  }, [format])

  const capturePng = useCallback(async (): Promise<string> => {
    const node = activeNode()
    if (!node) throw new Error('Template not ready')
    const { captureNodePng } = await import('@/lib/share/captureNode')
    return captureNodePng(node)
  }, [activeNode])

  const safeSlug = (data.slug || 'event').replace(/[^a-z0-9-]/gi, '-').toLowerCase()

  const savePngFile = useCallback(
    (dataUrl: string, name: string) => {
      const link = document.createElement('a')
      link.download = name
      link.href = dataUrl
      link.click()
    },
    [],
  )

  const handleDownload = useCallback(async () => {
    if (busy || recording) return
    setBusy('download')
    track('studio_download', { format, look })
    try {
      const dataUrl = await capturePng()
      savePngFile(dataUrl, `albago-${safeSlug}-${format}.png`)
      showToast(t('studio_downloaded'))
    } catch (e) {
      console.error(e)
      showToast(t('share_ai_error'), false)
    } finally {
      setBusy(null)
    }
  }, [busy, recording, capturePng, format, look, safeSlug, savePngFile, showToast, t, track])

  const handleShare = useCallback(async () => {
    if (busy || recording) return
    setBusy('share')
    try {
      const dataUrl = await capturePng()
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `albago-${safeSlug}-${format}.png`, {
        type: 'image/png',
      })
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: data.title,
          text: captions[captionLang],
        })
        track('studio_share', { format, look, via: 'native' })
        showToast(t('studio_shared'))
      } else {
        // Clipboard image support varies (Firefox lacks ClipboardItem) —
        // the design must always end up in the user's hands, so fall back
        // to a straight file save rather than a dead error.
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          track('studio_share', { format, look, via: 'clipboard' })
          showToast(t('studio_image_copied'))
        } catch {
          savePngFile(dataUrl, `albago-${safeSlug}-${format}.png`)
          track('studio_share', { format, look, via: 'download' })
          showToast(t('studio_downloaded'))
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        console.error(e)
        showToast(t('share_ai_error'), false)
      }
    } finally {
      setBusy(null)
    }
  }, [busy, recording, capturePng, captions, captionLang, data.title, format, look, safeSlug, savePngFile, showToast, t, track])

  // The whole kit in one tap: every format + all four captions, zipped.
  const handleKit = useCallback(async () => {
    if (busy || recording) return
    setBusy('kit')
    track('studio_kit', { look })
    try {
      const { captureNodePng } = await import('@/lib/share/captureNode')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const nodes: Array<[Format, HTMLElement | null]> = [
        ['story', storyRef.current],
        ['square', squareRef.current],
        ['card', cardRef.current],
      ]
      for (const [name, node] of nodes) {
        if (!node) continue
        const dataUrl = await captureNodePng(node)
        zip.file(`albago-${safeSlug}-${name}.png`, dataUrl.split(',')[1], { base64: true })
      }
      const captionsTxt = LANGS.map(
        (l) => `────────  ${l.toUpperCase()}  ────────\n\n${captions[l]}`,
      ).join('\n\n\n')
      zip.file(`albago-${safeSlug}-captions.txt`, captionsTxt)
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `albago-${safeSlug}-kit.zip`
      link.href = url
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      showToast(t('studio_kit_done'))
    } catch (e) {
      console.error(e)
      showToast(t('share_ai_error'), false)
    } finally {
      setBusy(null)
    }
  }, [busy, recording, captions, look, safeSlug, showToast, t, track])

  // Reels always animate the Story artwork — its node is permanently mounted
  // off-screen, so recording works from any visible format.
  const handleReel = useCallback(
    async (sec: 15 | 30) => {
      if (recording || busy) return
      setRecording(sec)
      setRecordProgress(0)
      track('studio_reel', { seconds: sec, look, motion })
      try {
        const node = storyRef.current
        if (!node) throw new Error('Template not ready')
        const { recordPosterVideo } = await import('@/lib/share/recordPosterVideo')
        const { blob, ext } = await recordPosterVideo({
          node,
          durationSec: sec,
          motion,
          onProgress: (frac) => setRecordProgress(frac),
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `albago-${safeSlug}-reel-${sec}s.${ext}`
        link.href = url
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
        showToast(t('studio_downloaded'))
      } catch (e) {
        console.error(e)
        showToast(e instanceof Error && e.message ? e.message : t('share_ai_error'), false)
      } finally {
        setRecording(null)
        setRecordProgress(0)
      }
    },
    [busy, look, motion, recording, safeSlug, showToast, t, track],
  )

  const copyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(captions[captionLang])
      showToast(t('studio_caption_copied'))
      track('studio_caption_copy', { lang: captionLang })
    } catch {
      showToast(t('share_ai_error'), false)
    }
  }, [captions, captionLang, showToast, t, track])

  // ---- keyboard shortcuts (desktop power flow) -------------------------
  const canBrowsePhotos =
    hasPhotos && images.length > 1 && (look === 'cinematic' || look === 'photo' || look === 'noir')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
        return
      }
      switch (e.key) {
        case '1':
          setFormat('story')
          break
        case '2':
          setFormat('square')
          break
        case '3':
          setFormat('card')
          break
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!canBrowsePhotos) return
          e.preventDefault()
          const dir = e.key === 'ArrowRight' ? 1 : -1
          applyLook(look, (photoIdx + dir + images.length) % images.length)
          break
        }
        case 's':
        case 'S':
          handleShare()
          break
        case 'd':
        case 'D':
          handleDownload()
          break
        case 'k':
        case 'K':
          handleKit()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyLook, canBrowsePhotos, handleDownload, handleKit, handleShare, images.length, look, photoIdx])

  // ---- preview scaling -------------------------------------------------
  const previewWrapRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.28)
  useEffect(() => {
    const el = previewWrapRef.current
    if (!el) return
    const measure = () => setScale(el.clientWidth / FORMAT_DIMS[format].w)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [format])

  const dims = FORMAT_DIMS[format]

  const looks: Array<{ id: Look; label: string }> = [
    ...(hasPhotos
      ? ([
          { id: 'cinematic', label: t('studio_look_cinematic') },
          { id: 'photo', label: t('studio_look_photo') },
          { id: 'noir', label: t('studio_look_noir') },
        ] as const)
      : []),
    { id: 'ink', label: t('studio_look_ink') },
    { id: 'ai', label: t('studio_look_ai') },
  ]

  const motionLabels: Record<ReelMotion, string> = {
    drift: t('studio_motion_drift'),
    pulse: t('studio_motion_pulse'),
    sweep: t('studio_motion_sweep'),
  }

  const templateProps = { data, qrDataUrl, backdropUrl: backdrop }

  return (
    <main className="min-h-screen bg-[#050505] pb-28 text-white">
      {/* ---- reveal overlay ---- */}
      <div
        aria-hidden={revealDone}
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] transition-opacity duration-700 ${
          revealDone ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <p
          className="text-5xl sm:text-6xl"
          style={{ fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif" }}
        >
          AlbaGo <span className="italic text-flame-500">Studio</span>
        </p>
        <div className="mt-10 flex flex-col gap-3 text-sm text-white/60">
          {(
            [
              { done: steps.read, label: t('studio_step_read') },
              { done: steps.art, label: t('studio_step_art') },
              { done: steps.type, label: t('studio_step_type') },
            ] as const
          ).map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              {s.done ? (
                <Check className="h-4 w-4 text-flame-400" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-white/30" />
              )}
              <span className={s.done ? 'text-white/85' : ''}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- top bar ---- */}
      <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            href={`/events/${data.slug}`}
            aria-label="Back to event"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/65 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p
              className="text-lg leading-tight"
              style={{ fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif" }}
            >
              AlbaGo <span className="italic text-flame-500">Studio</span>
            </p>
            <p className="truncate text-[11px] text-white/45">{data.title}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10">
        {/* ---- preview ---- */}
        <div>
          {/* format tabs */}
          <div className="mt-5 flex items-center justify-center gap-2 lg:justify-start">
            {(Object.keys(FORMAT_DIMS) as Format[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
                  format === f
                    ? 'bg-flame-500/20 text-flame-100 ring-1 ring-flame-500/40'
                    : 'bg-white/[0.05] text-white/60 hover:bg-white/[0.09]'
                }`}
              >
                {FORMAT_DIMS[f].label}
                <span className="ml-1.5 text-[10px] font-normal opacity-60">
                  {f === 'story' ? '9:16' : f === 'square' ? '1:1' : '1200×630'}
                </span>
              </button>
            ))}
          </div>

          {/* live poster — the exact design that gets captured */}
          <div
            ref={previewWrapRef}
            className="relative mx-auto mt-4 w-full max-w-[420px] lg:max-w-none"
          >
            <div
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
              style={{ height: dims.h * scale }}
            >
              <div
                style={{
                  width: dims.w,
                  height: dims.h,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                {format === 'story' && <StoryShareTemplate {...templateProps} />}
                {format === 'square' && <SquareShareTemplate {...templateProps} />}
                {format === 'card' && <FacebookShareTemplate {...templateProps} />}
              </div>
              {(backdropLoading || aiPainting) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <Loader2 className="h-6 w-6 animate-spin text-flame-300" />
                </div>
              )}
            </div>
          </div>

          {/* keyboard hint — desktop only */}
          <p className="mt-3 hidden text-[11px] text-white/30 lg:block">
            {t('studio_shortcuts')}
          </p>
        </div>

        {/* ---- controls rail ---- */}
        <div className="mt-8 flex flex-col gap-7 lg:mt-16">
          {/* Look */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {t('studio_look')}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {looks.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={backdropLoading || aiPainting}
                  onClick={() => {
                    if (l.id === look) return
                    track('studio_look', { look: l.id })
                    if (l.id === 'ai' && !aiBackdrop) {
                      paintAi()
                    } else {
                      applyLook(l.id)
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold transition disabled:opacity-60 ${
                    look === l.id
                      ? 'bg-flame-500/20 text-flame-100 ring-1 ring-flame-500/40'
                      : 'bg-white/[0.05] text-white/65 hover:bg-white/[0.09]'
                  }`}
                >
                  {l.id === 'ai' && aiPainting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : l.id === 'ai' ? (
                    <Sparkles className="h-3 w-3" />
                  ) : null}
                  {l.id === 'ai' && aiPainting ? t('studio_ai_painting') : l.label}
                </button>
              ))}
              {GRADED_LOOKS.includes(look) && (
                <button
                  type="button"
                  onClick={handleShuffle}
                  disabled={backdropLoading}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-4 py-2 text-[12px] font-semibold text-white/65 transition hover:bg-white/[0.09] disabled:opacity-60"
                >
                  <Shuffle className="h-3 w-3" />
                  {t('studio_shuffle')}
                </button>
              )}
              {look === 'ai' && aiBackdrop && (
                <button
                  type="button"
                  onClick={() => paintAi(true)}
                  disabled={aiPainting}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-4 py-2 text-[12px] font-semibold text-white/65 transition hover:bg-white/[0.09] disabled:opacity-60"
                >
                  <RefreshCw className={`h-3 w-3 ${aiPainting ? 'animate-spin' : ''}`} />
                  {t('share_ai_regenerate')}
                </button>
              )}
            </div>
          </div>

          {/* Photo picker */}
          {canBrowsePhotos && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {t('studio_photo')}
              </p>
              <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => applyLook(look, i)}
                    className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border transition ${
                      photoIdx === i
                        ? 'border-flame-500/70 ring-1 ring-flame-500/40'
                        : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={busy !== null || recording !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-flame-500 disabled:cursor-wait disabled:opacity-70"
            >
              {busy === 'share' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              {t('studio_share')}
            </button>
            <button
              type="button"
              onClick={handleKit}
              disabled={busy !== null || recording !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-5 py-3 text-[13px] font-bold text-flame-100 transition hover:bg-flame-500/[0.14] disabled:opacity-60"
            >
              {busy === 'kit' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              {t('studio_kit')}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy !== null || recording !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12px] font-semibold text-white/85 transition hover:bg-white/[0.08] disabled:opacity-60"
              >
                {busy === 'download' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                PNG
              </button>
              {([15, 30] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleReel(sec)}
                  disabled={busy !== null || recording !== null}
                  className="relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12px] font-semibold text-white/85 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {recording === sec && (
                    <span
                      className="absolute inset-y-0 left-0 bg-flame-500/20 transition-[width] duration-150"
                      style={{ width: `${Math.round(recordProgress * 100)}%` }}
                      aria-hidden
                    />
                  )}
                  {recording === sec ? (
                    <Loader2 className="relative h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Video className="relative h-3.5 w-3.5" />
                  )}
                  <span className="relative">{sec}s</span>
                </button>
              ))}
            </div>
            {/* Motion preset for the reels */}
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {t('studio_motion')}
              </span>
              {MOTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotion(m)}
                  disabled={recording !== null}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
                    motion === m
                      ? 'bg-flame-500/20 text-flame-100 ring-1 ring-flame-500/40'
                      : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.09]'
                  }`}
                >
                  {motionLabels[m]}
                </button>
              ))}
            </div>
            {recording !== null && (
              <p className="text-center text-[11px] text-white/45">{t('studio_reel_hint')}</p>
            )}
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {t('share_caption')}
                {!captionsDone && (
                  <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-white/30" />
                )}
              </p>
              <button
                type="button"
                onClick={copyCaption}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-flame-300 transition hover:text-flame-200"
              >
                <Copy className="h-3.5 w-3.5" />
                {t('share_copy_caption')}
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setCaptionLang(l)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
                    captionLang === l
                      ? 'bg-flame-500/20 text-flame-100 ring-1 ring-flame-500/40'
                      : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.09]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <textarea
              value={captions[captionLang]}
              onChange={(e) => {
                editedLangs.current.add(captionLang)
                setCaptions((c) => ({ ...c, [captionLang]: e.target.value }))
              }}
              rows={7}
              className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/85 focus:border-flame-500/40 focus:outline-none"
              spellCheck={false}
            />
          </div>

          <p className="flex items-center gap-2 text-[11px] text-white/35">
            <ImageIcon className="h-3.5 w-3.5" />
            {t('studio_footnote')}
          </p>
        </div>
      </div>

      {/* ---- off-screen capture nodes (natural size, single source of truth) ---- */}
      <div
        aria-hidden
        style={{ position: 'fixed', top: 0, left: -100000, width: 1200, pointerEvents: 'none' }}
      >
        <StoryShareTemplate {...templateProps} innerRef={storyRef} />
        <SquareShareTemplate {...templateProps} innerRef={squareRef} />
        <FacebookShareTemplate {...templateProps} innerRef={cardRef} />
      </div>

      {/* ---- toast ---- */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${
            toast.ok
              ? 'border-emerald-500/25 bg-emerald-950/80 text-emerald-100'
              : 'border-flame-500/30 bg-[#1a0505]/90 text-flame-200'
          }`}
        >
          {toast.ok ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <X className="h-4 w-4 text-flame-400" />
          )}
          {toast.msg}
        </div>
      )}
    </main>
  )
}
