type Options = {
  node: HTMLElement
  durationSec: 15 | 30
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

export async function recordPosterVideo({
  node,
  durationSec,
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

  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = performance.now() - startedAt
      const t = Math.min(elapsed / totalMs, 1)

      const scale = 1 + 0.08 * easeOutQuad(t)

      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(scale, scale)
      ctx.drawImage(img, -width / 2, -height / 2, width, height)
      ctx.restore()

      const sweepCycleSec = 6
      const sweepPhase = (elapsed / 1000 / sweepCycleSec) % 1
      const sweepCenter = -width * 0.4 + sweepPhase * (width * 1.8)
      const sweepWidth = width * 0.35

      const grad = ctx.createLinearGradient(
        sweepCenter - sweepWidth / 2,
        0,
        sweepCenter + sweepWidth / 2,
        height * 0.6,
      )
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.07)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)

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
