/**
 * Tier-1 poster backdrop: grade the event's OWN photo into the AlbaGo brand,
 * entirely client-side. No image model, no server round-trip, no storage —
 * a real uploaded photo remapped to ink-black + flame-red is more specific
 * and more premium than anything a free image generator hallucinates.
 *
 * Output is a 1080×1920 JPEG data URL used as `backdropUrl` on the share
 * templates, so the existing typography, QR and AlbaGo layer composite on top
 * exactly as they do over the AI backdrop. The templates apply their own
 * legibility scrim, so this pass is purely tonal — duotone + grain + a light
 * vignette — and deliberately does NOT bake in gradients of its own.
 */

// Luminance → [r,g,b] ramp: ink shadows, flame highlights, ember speculars.
const STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 5, 5, 5],
  [0.42, 74, 10, 13],
  [0.72, 200, 22, 29],
  [0.9, 238, 28, 37],
  [1.0, 255, 122, 92],
]

function buildLUT(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    // gamma < 1 deepens shadows so the frame keeps dark negative space
    const t = Math.pow(i / 255, 1.28)
    let s = 0
    while (s < STOPS.length - 1 && t > STOPS[s + 1][0]) s++
    const a = STOPS[s]
    const b = STOPS[Math.min(s + 1, STOPS.length - 1)]
    const span = b[0] - a[0] || 1
    let f = (t - a[0]) / span
    if (f < 0) f = 0
    if (f > 1) f = 1
    lut[i * 3] = a[1] + (b[1] - a[1]) * f
    lut[i * 3 + 1] = a[2] + (b[2] - a[2]) * f
    lut[i * 3 + 2] = a[3] + (b[3] - a[3]) * f
  }
  return lut
}

const LUT = buildLUT()

let grainTile: HTMLCanvasElement | null = null
function getGrain(): HTMLCanvasElement {
  if (grainTile) return grainTile
  const c = document.createElement('canvas')
  c.width = c.height = 180
  const g = c.getContext('2d')!
  const id = g.createImageData(180, 180)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  g.putImageData(id, 0, 0)
  grainTile = c
  return c
}

/**
 * Fetch an image URL and return it as a data URL, untouched. Used for the
 * clean "Photo" look — the template's own scrim handles legibility. Going
 * through blob → data URL keeps html-to-image capture free of CORS taint.
 */
export async function imageToDataUrl(src: string): Promise<string> {
  const res = await fetch(src, { mode: 'cors', cache: 'force-cache' })
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`)
  const blob = await res.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('image read failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Grade a source image URL into a branded backdrop data URL.
 * Fetched as a blob first (like the AI backdrop path) so the canvas is never
 * tainted and `toDataURL` stays readable. Throws on fetch/decode failure —
 * the caller falls back to the brand or AI backdrop.
 */
export async function gradeBackdrop(
  src: string,
  width = 1080,
  height = 1920,
): Promise<string> {
  const res = await fetch(src, { mode: 'cors', cache: 'force-cache' })
  if (!res.ok) throw new Error(`backdrop image fetch failed: ${res.status}`)
  const blob = await res.blob()
  const bmp = await createImageBitmap(blob)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  // Cover-fit, centred.
  const scale = Math.max(width / bmp.width, height / bmp.height)
  const dw = bmp.width * scale
  const dh = bmp.height * scale
  ctx.drawImage(bmp, (width - dw) / 2, (height - dh) / 2, dw, dh)
  bmp.close?.()

  // Duotone remap.
  const frame = ctx.getImageData(0, 0, width, height)
  const d = frame.data
  for (let i = 0; i < d.length; i += 4) {
    const L = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
    d[i] = LUT[L * 3]
    d[i + 1] = LUT[L * 3 + 1]
    d[i + 2] = LUT[L * 3 + 2]
  }
  ctx.putImageData(frame, 0, 0)

  // Film grain — the difference between "digital" and "cinematic".
  ctx.globalAlpha = 0.05
  ctx.globalCompositeOperation = 'overlay'
  const pattern = ctx.createPattern(getGrain(), 'repeat')
  if (pattern) {
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, width, height)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  // Light vignette (kept mild — the template adds its own scrim on top).
  const vg = ctx.createRadialGradient(
    width / 2,
    height * 0.46,
    height * 0.3,
    width / 2,
    height * 0.5,
    height * 0.75,
  )
  vg.addColorStop(0, 'rgba(5,5,5,0)')
  vg.addColorStop(1, 'rgba(5,5,5,0.4)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, width, height)

  // Faint flame bloom low in the frame — echoes the brand light source.
  ctx.globalCompositeOperation = 'screen'
  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.9,
    0,
    width * 0.5,
    height * 0.9,
    width * 0.85,
  )
  glow.addColorStop(0, 'rgba(238,28,37,0.14)')
  glow.addColorStop(1, 'rgba(238,28,37,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  return canvas.toDataURL('image/jpeg', 0.9)
}
