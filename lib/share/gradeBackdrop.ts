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
 *
 * Two grades share the pipeline:
 *   flame — ink shadows → flame reds → ember speculars (the Cinematic look)
 *   noir  — neutral silver gelatin with the flame bloom kept as the single
 *           brand accent (the Noir look)
 *
 * A `seed` varies the taste parameters (gamma, bloom placement/strength,
 * vignette) inside art-directed bounds — that is the Shuffle button: every
 * press is a different-but-always-on-brand variation of the same photo.
 */

export type GradeVariant = 'flame' | 'noir'

export type GradeOptions = {
  width?: number
  height?: number
  variant?: GradeVariant
  /** Same seed → same grade. Omit (or 0) for the house default. */
  seed?: number
}

// Luminance → [r,g,b] ramps.
const FLAME_STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 5, 5, 5],
  [0.42, 74, 10, 13],
  [0.72, 200, 22, 29],
  [0.9, 238, 28, 37],
  [1.0, 255, 122, 92],
]

const NOIR_STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 5, 5, 6],
  [0.45, 92, 92, 97],
  [0.8, 205, 205, 210],
  [1.0, 250, 250, 252],
]

function buildLUT(
  stops: ReadonlyArray<readonly [number, number, number, number]>,
  gamma: number,
): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    // gamma < 1 deepens shadows so the frame keeps dark negative space
    const t = Math.pow(i / 255, gamma)
    let s = 0
    while (s < stops.length - 1 && t > stops[s + 1][0]) s++
    const a = stops[s]
    const b = stops[Math.min(s + 1, stops.length - 1)]
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

/** Deterministic PRNG so a seed always reproduces the exact same grade. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Taste parameters, either the house defaults (seed 0) or a seeded riff
 *  inside art-directed bounds — never outside the brand. */
function gradeParams(seed: number) {
  if (!seed) {
    return { gamma: 1.28, glowX: 0.5, glowY: 0.9, glowR: 0.85, glowA: 0.14, vignette: 0.4 }
  }
  const rnd = mulberry32(seed)
  return {
    gamma: 1.16 + rnd() * 0.26,
    glowX: 0.25 + rnd() * 0.5,
    glowY: 0.78 + rnd() * 0.18,
    glowR: 0.7 + rnd() * 0.45,
    glowA: 0.1 + rnd() * 0.1,
    vignette: 0.3 + rnd() * 0.22,
  }
}

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
export async function gradeBackdrop(src: string, opts: GradeOptions = {}): Promise<string> {
  const { width = 1080, height = 1920, variant = 'flame', seed = 0 } = opts
  const p = gradeParams(seed)
  const lut = buildLUT(variant === 'noir' ? NOIR_STOPS : FLAME_STOPS, p.gamma)

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
    d[i] = lut[L * 3]
    d[i + 1] = lut[L * 3 + 1]
    d[i + 2] = lut[L * 3 + 2]
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
  vg.addColorStop(1, `rgba(5,5,5,${p.vignette})`)
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, width, height)

  // Faint flame bloom — echoes the brand light source. Kept even in noir:
  // the single red accent on silver is the AlbaGo signature.
  ctx.globalCompositeOperation = 'screen'
  const glow = ctx.createRadialGradient(
    width * p.glowX,
    height * p.glowY,
    0,
    width * p.glowX,
    height * p.glowY,
    width * p.glowR,
  )
  const glowA = variant === 'noir' ? Math.min(p.glowA, 0.11) : p.glowA
  glow.addColorStop(0, `rgba(238,28,37,${glowA})`)
  glow.addColorStop(1, 'rgba(238,28,37,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  return canvas.toDataURL('image/jpeg', 0.9)
}
