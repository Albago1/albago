export type ReelMotion = 'drift' | 'pulse' | 'sweep'

type Options = {
  node: HTMLElement
  durationSec: 15 | 30
  motion?: ReelMotion
  width?: number
  height?: number
  fps?: number
  onProgress?: (fraction: number, elapsedSec: number) => void
}

type Result = {
  blob: Blob
  ext: 'mp4' | 'webm'
  mimeType: string
}

const MIME_CANDIDATES: Array<{ mime: string; ext: 'mp4' | 'webm' }> = [
  { mime: 'video/mp4;codecs=h264', ext: 'mp4' },
  { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
]

function pickMime(): { mime: string; ext: 'mp4' | 'webm' } {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    throw new Error('Video recording is not supported in this browser.')
  }
  for (const c of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c
  }
  throw new Error('No supported video codec available in this browser.')
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/* Each motion preset paints one frame. All of them stay inside the same
   taste rules: slow, weighty, never gimmicky — the poster is the star. */
type FrameCtx = {
  ctx: CanvasRenderingContext2D
  img: HTMLImageElement
  width: number
  height: number
  /** 0→1 across the whole clip */
  t: number
  /** seconds elapsed */
  sec: number
}

function paintDrift({ ctx, img, width, height, t, sec }: FrameCtx) {
  // The original look: one continuous ease-out push-in + a soft light pass.
  const scale = 1 + 0.08 * easeOutQuad(t)
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.scale(scale, scale)
  ctx.drawImage(img, -width / 2, -height / 2, width, height)
  ctx.restore()
  paintLightSweep(ctx, width, height, sec, 6, 0.07)
}

function paintPulse({ ctx, img, width, height, sec }: FrameCtx) {
  // Breathing: a slow scale oscillation with the flame bloom inhaling in sync.
  const breath = Math.sin((sec / 5) * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5 // 0..1, 5s cycle
  const scale = 1.03 + 0.025 * breath
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.scale(scale, scale)
  ctx.drawImage(img, -width / 2, -height / 2, width, height)
  ctx.restore()

  ctx.globalCompositeOperation = 'screen'
  const glow = ctx.createRadialGradient(
    width / 2,
    height * 0.92,
    0,
    width / 2,
    height * 0.92,
    width * 0.9,
  )
  glow.addColorStop(0, `rgba(238,28,37,${0.05 + 0.09 * breath})`)
  glow.addColorStop(1, 'rgba(238,28,37,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
}

function paintSweep({ ctx, img, width, height, t, sec }: FrameCtx) {
  // Slow lateral drift over an over-scanned frame + a stronger light pass.
  const scale = 1.1
  const pan = Math.sin((sec / 14) * Math.PI * 2) * width * 0.03
  ctx.save()
  ctx.translate(width / 2 + pan, height / 2)
  ctx.scale(scale, scale)
  ctx.drawImage(img, -width / 2, -height / 2, width, height)
  ctx.restore()
  paintLightSweep(ctx, width, height, sec, 4.5, 0.11)
  void t
}

function paintLightSweep(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sec: number,
  cycleSec: number,
  strength: number,
) {
  const phase = (sec / cycleSec) % 1
  const center = -width * 0.4 + phase * (width * 1.8)
  const sweepWidth = width * 0.35
  const grad = ctx.createLinearGradient(
    center - sweepWidth / 2,
    0,
    center + sweepWidth / 2,
    height * 0.6,
  )
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, `rgba(255,255,255,${strength})`)
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
}

const PAINTERS: Record<ReelMotion, (f: FrameCtx) => void> = {
  drift: paintDrift,
  pulse: paintPulse,
  sweep: paintSweep,
}

export async function recordPosterVideo({
  node,
  durationSec,
  motion = 'drift',
  width = 1080,
  height = 1920,
  fps = 30,
  onProgress,
}: Options): Promise<Result> {
  const { mime, ext } = pickMime()

  const { captureNodePng } = await import('./captureNode')
  const dataUrl = await captureNodePng(node, { width, height })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Could not load poster image.'))
    el.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable.')

  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const stream = (canvas as HTMLCanvasElement).captureStream(fps)
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = (e) => reject(new Error('Recorder error: ' + String(e)))
  })

  recorder.start()

  const startedAt = performance.now()
  const totalMs = durationSec * 1000
  const paint = PAINTERS[motion]

  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = performance.now() - startedAt
      const t = Math.min(elapsed / totalMs, 1)

      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, width, height)
      paint({ ctx, img, width, height, t, sec: elapsed / 1000 })

      if (onProgress) onProgress(t, elapsed / 1000)

      if (elapsed < totalMs) {
        requestAnimationFrame(frame)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(frame)
  })

  recorder.stop()
  await stopped

  const blob = new Blob(chunks, { type: mime })
  return { blob, ext, mimeType: mime }
}
