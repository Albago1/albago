'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Flashlight,
  Loader2,
  Search,
  WifiOff,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { importEventKey, verifyTicketTokenBrowser } from '@/lib/tickets/qrTokenBrowser'

export type DoorEvent = {
  id: string
  title: string
  date: string
  time: string | null
}

export type DoorAttendee = {
  ticketId: string
  name: string | null
  email: string | null
  serial: string
  tierName: string
  status: 'valid' | 'checked_in'
  checkedInAt: string | null
}

type CheckInResult = {
  result: 'ok' | 'duplicate' | 'void' | 'refunded' | 'wrong_event' | 'not_found' | 'bad_signature'
  serial: string | null
  tier_name: string | null
  attendee: string | null
  checked_in_at: string | null
  payment_due_at_door: boolean
  stats: { issued: number; checked_in: number }
}

type VerdictKind = 'ok' | 'reject' | 'offline'
type Verdict = {
  kind: VerdictKind
  title: string
  subtitle?: string
  attendee?: string | null
  tier?: string | null
}

// Minimal shape of the native BarcodeDetector (not in lib.dom types yet).
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike
type JsQr = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts?: { inversionAttempts?: string },
) => { data: string } | null

const SAME_TOKEN_COOLDOWN_MS = 2600
const DECODE_INTERVAL_MS = 140
const GREEN_HOLD_MS = 1300
const REJECT_HOLD_MS = 2600

function timeLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function verdictFromResult(r: CheckInResult): Verdict {
  const who = r.attendee || r.serial || ''
  switch (r.result) {
    case 'ok':
      return { kind: 'ok', title: 'Checked in', attendee: who, tier: r.tier_name }
    case 'duplicate':
      return {
        kind: 'reject',
        title: 'Already checked in',
        subtitle: r.checked_in_at ? `Entered at ${timeLabel(r.checked_in_at)}` : 'Already used',
        attendee: who,
        tier: r.tier_name,
      }
    case 'void':
      return { kind: 'reject', title: 'Void ticket', subtitle: 'This ticket was cancelled', attendee: who }
    case 'refunded':
      return { kind: 'reject', title: 'Refunded ticket', subtitle: 'This ticket was refunded', attendee: who }
    case 'wrong_event':
      return { kind: 'reject', title: 'Wrong event', subtitle: 'This ticket is for another event' }
    case 'not_found':
      return { kind: 'reject', title: 'Not found', subtitle: 'No such ticket' }
    default:
      return { kind: 'reject', title: 'Invalid ticket', subtitle: 'Not a genuine AlbaGo ticket' }
  }
}

export default function DoorScannerClient({
  event,
  kEvent,
  attendees: initialAttendees,
  initialStats,
}: {
  event: DoorEvent
  kEvent: string | null
  attendees: DoorAttendee[]
  initialStats: { issued: number; checkedIn: number }
}) {
  const supabase = useMemo(() => createClient(), [])

  const [phase, setPhase] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [stats, setStats] = useState(initialStats)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [attendees, setAttendees] = useState<DoorAttendee[]>(initialAttendees)
  const [manualBusy, setManualBusy] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const keyRef = useRef<CryptoKey | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const jsqrRef = useRef<JsQr | null>(null)
  const loopRef = useRef<number | null>(null)
  const lastDecodeRef = useRef(0)
  const lastTokenRef = useRef<{ raw: string; at: number }>({ raw: '', at: 0 })
  const processingRef = useRef(false)
  const audioRef = useRef<AudioContext | null>(null)

  const beep = useCallback((kind: VerdictKind) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      if (!audioRef.current) audioRef.current = new Ctx()
      const ctx = audioRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = kind === 'ok' ? 880 : kind === 'offline' ? 520 : 220
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
      osc.start()
      osc.stop(ctx.currentTime + 0.24)
    } catch {
      /* audio is a nicety, never block the scan on it */
    }
  }, [])

  const showVerdict = useCallback(
    (v: Verdict) => {
      setVerdict(v)
      try {
        navigator.vibrate?.(
          v.kind === 'ok' ? 90 : v.kind === 'offline' ? [40, 40] : [70, 55, 70, 55, 70],
        )
      } catch {
        /* vibration unsupported — fine */
      }
      beep(v.kind)
      window.setTimeout(
        () => {
          setVerdict(null)
          processingRef.current = false
        },
        v.kind === 'ok' ? GREEN_HOLD_MS : REJECT_HOLD_MS,
      )
    },
    [beep],
  )

  const applyStats = useCallback((s: { issued: number; checked_in: number }) => {
    setStats({ issued: s.issued, checkedIn: s.checked_in })
  }, [])

  // Mark a ticket checked-in locally so the manual list + our own counters stay
  // in step between server reads.
  const markLocal = useCallback((ticketId: string, at: string | null) => {
    setAttendees((prev) =>
      prev.map((a) =>
        a.ticketId === ticketId ? { ...a, status: 'checked_in', checkedInAt: at } : a,
      ),
    )
  }, [])

  const handleToken = useCallback(
    async (raw: string) => {
      if (processingRef.current) return
      const now = Date.now()
      if (raw === lastTokenRef.current.raw && now - lastTokenRef.current.at < SAME_TOKEN_COOLDOWN_MS) {
        return
      }
      lastTokenRef.current = { raw, at: now }
      processingRef.current = true

      // 1. Verify the signature locally — instant, offline, and the real
      // anti-forgery gate (check_in_ticket trusts whatever ticket id it's given).
      const key = keyRef.current
      if (!key) {
        showVerdict({ kind: 'reject', title: 'Door key missing', subtitle: 'Server key not configured' })
        return
      }
      const verified = await verifyTicketTokenBrowser(raw, key)
      if (!verified.ok) {
        showVerdict({
          kind: 'reject',
          title: 'Invalid ticket',
          subtitle: verified.reason === 'malformed' ? 'Not an AlbaGo ticket' : 'Signature does not match',
        })
        // Best-effort audit log (online only); ignore failures.
        void supabase.rpc('check_in_ticket', {
          p_event_id: event.id,
          p_ticket_id: null,
          p_raw: raw,
          p_device_note: 'door',
        })
        return
      }

      // 2. Authoritative check-in.
      try {
        const { data, error } = await supabase.rpc('check_in_ticket', {
          p_event_id: event.id,
          p_ticket_id: verified.ticketId,
          p_raw: raw,
          p_device_note: 'door',
        })
        if (error || !data) {
          showVerdict({ kind: 'offline', title: 'Could not confirm', subtitle: 'Reconnect and scan again' })
          return
        }
        const r = data as CheckInResult
        applyStats(r.stats)
        if (r.result === 'ok' || r.result === 'duplicate') {
          markLocal(verified.ticketId, r.checked_in_at)
        }
        showVerdict(verdictFromResult(r))
      } catch {
        showVerdict({ kind: 'offline', title: 'Could not confirm', subtitle: 'Reconnect and scan again' })
      }
    },
    [supabase, event.id, showVerdict, applyStats, markLocal],
  )

  // One decode tick: pull a frame, try the native detector, else jsQR.
  const decodeTick = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2 || processingRef.current) return

    let raw: string | null = null
    try {
      if (detectorRef.current) {
        const codes = await detectorRef.current.detect(video)
        if (codes.length > 0) raw = codes[0].rawValue
      } else if (jsqrRef.current) {
        const w = video.videoWidth
        const h = video.videoHeight
        if (w === 0 || h === 0) return
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(video, 0, 0, w, h)
        const img = ctx.getImageData(0, 0, w, h)
        const found = jsqrRef.current(img.data, w, h, { inversionAttempts: 'attemptBoth' })
        if (found) raw = found.data
      }
    } catch {
      /* a single bad frame is nothing — keep looping */
    }
    if (raw) void handleToken(raw)
  }, [handleToken])

  // Camera + decoder lifecycle. Runs once; all state changes happen inside async
  // callbacks (not synchronously in the effect body).
  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (kEvent) {
        try {
          keyRef.current = await importEventKey(kEvent)
        } catch {
          keyRef.current = null
        }
      }

      // Pick a decoder: native BarcodeDetector (Android Chrome) if it supports
      // QR, else the jsQR fallback (iOS Safari, Firefox, …).
      const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      if (BD) {
        try {
          detectorRef.current = new BD({ formats: ['qr_code'] })
        } catch {
          detectorRef.current = null
        }
      }
      if (!detectorRef.current) {
        try {
          const mod = (await import('jsqr')) as unknown as { default: JsQr }
          jsqrRef.current = mod.default
        } catch {
          /* handled below via the no-decoder guard */
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean }
        setTorchSupported(!!caps.torch)

        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        setPhase('scanning')

        loopRef.current = window.setInterval(() => {
          const t = Date.now()
          if (t - lastDecodeRef.current < DECODE_INTERVAL_MS) return
          lastDecodeRef.current = t
          void decodeTick()
        }, 60)
      } catch {
        setCameraError(
          'Camera access was blocked. Allow the camera in your browser, or use manual search below.',
        )
        setPhase('error')
      }
    }

    void boot()

    return () => {
      cancelled = true
      if (loopRef.current) window.clearInterval(loopRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void audioRef.current?.close().catch(() => undefined)
    }
  }, [kEvent, decodeTick])

  async function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
      setTorchOn(next)
    } catch {
      /* some devices report torch then refuse it — leave state as-is */
    }
  }

  async function manualCheckIn(a: DoorAttendee) {
    if (manualBusy) return
    setManualBusy(a.ticketId)
    try {
      const { data, error } = await supabase.rpc('check_in_ticket', {
        p_event_id: event.id,
        p_ticket_id: a.ticketId,
        p_raw: null,
        p_device_note: 'manual',
      })
      if (error || !data) {
        showVerdict({ kind: 'offline', title: 'Could not confirm', subtitle: 'Reconnect and try again' })
        return
      }
      const r = data as CheckInResult
      applyStats(r.stats)
      if (r.result === 'ok' || r.result === 'duplicate') markLocal(a.ticketId, r.checked_in_at)
      showVerdict(verdictFromResult(r))
    } finally {
      setManualBusy(null)
    }
  }

  const filteredAttendees = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return attendees.slice(0, 40)
    return attendees
      .filter(
        (a) =>
          (a.name ?? '').toLowerCase().includes(q) ||
          (a.email ?? '').toLowerCase().includes(q) ||
          a.serial.toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [attendees, query])

  const verdictBg =
    verdict?.kind === 'ok'
      ? 'bg-emerald-600'
      : verdict?.kind === 'offline'
        ? 'bg-amber-500'
        : 'bg-red-600'

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <Link
          href={`/organizer/events/${event.id}/tickets`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Done
        </Link>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold">{event.title}</p>
          <p className="text-[11px] text-white/50">Door check-in</p>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold tabular-nums backdrop-blur">
          <span className="text-emerald-400">{stats.checkedIn}</span>
          <span className="text-white/40"> / {stats.issued}</span>
        </div>
      </div>

      {/* Camera / viewfinder */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Reticle */}
        {phase === 'scanning' && !verdict && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-64 w-64 max-w-[72vw]">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-white/80" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-white/80" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-white/80" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-white/80" />
              <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-flame-500/70" />
            </div>
          </div>
        )}

        {phase === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Starting camera…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <X className="h-10 w-10 text-red-400" />
            <p className="max-w-xs text-sm text-white/70">{cameraError}</p>
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="mt-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold"
            >
              Open manual search
            </button>
          </div>
        )}

        {/* Full-screen verdict */}
        {verdict && (
          <button
            type="button"
            onClick={() => {
              setVerdict(null)
              processingRef.current = false
            }}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center ${verdictBg}`}
          >
            {verdict.kind === 'ok' ? (
              <CheckCircle2 className="h-24 w-24" strokeWidth={2.5} />
            ) : verdict.kind === 'offline' ? (
              <WifiOff className="h-20 w-20" strokeWidth={2.5} />
            ) : (
              <Ban className="h-24 w-24" strokeWidth={2.5} />
            )}
            <p className="text-3xl font-bold">{verdict.title}</p>
            {verdict.attendee && <p className="text-xl font-semibold">{verdict.attendee}</p>}
            {verdict.tier && <p className="-mt-2 text-base text-white/80">{verdict.tier}</p>}
            {verdict.subtitle && <p className="text-base text-white/85">{verdict.subtitle}</p>}
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        {torchSupported && (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              torchOn ? 'bg-white text-black' : 'bg-white/10 text-white/90 hover:bg-white/20'
            }`}
          >
            <Flashlight className="h-4 w-4" />
            Torch
          </button>
        )}
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/20"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      {/* Manual search sheet */}
      {manualOpen && (
        <div className="absolute inset-0 z-[95] flex flex-col bg-ink-950/98 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <p className="text-sm font-semibold">Manual check-in</p>
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
              aria-label="Close manual search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, or serial"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex-1 overflow-y-auto px-4 pb-8">
            {filteredAttendees.length === 0 ? (
              <p className="mt-8 text-center text-sm text-white/45">
                {attendees.length === 0 ? 'No tickets to admit yet.' : 'No match.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredAttendees.map((a) => {
                  const isIn = a.status === 'checked_in'
                  return (
                    <li
                      key={a.ticketId}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white/90">{a.name || 'Guest'}</p>
                        <p className="truncate text-[11px] text-white/40">
                          {[a.tierName, a.serial].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {isIn ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          In{a.checkedInAt ? ` · ${timeLabel(a.checkedInAt)}` : ''}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void manualCheckIn(a)}
                          disabled={manualBusy === a.ticketId}
                          className="inline-flex items-center gap-1.5 rounded-full bg-flame-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-flame-400 disabled:opacity-50"
                        >
                          {manualBusy === a.ticketId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Check in
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
