import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Returns the visitor's approximate location from Vercel edge headers.
 *
 * On Vercel these are present out of the box. On localhost they will be
 * absent — the response carries `available: false` so the caller can
 * silently fall back to the hardcoded default.
 *
 * No personal data is logged; we only relay the headers Vercel attached
 * to this request.
 */
export async function GET() {
  const h = await headers()

  const decode = (raw: string | null): string | null => {
    if (!raw) return null
    try {
      return decodeURIComponent(raw).trim() || null
    } catch {
      return raw.trim() || null
    }
  }

  const city = decode(h.get('x-vercel-ip-city'))
  const country = decode(h.get('x-vercel-ip-country'))
  const region = decode(h.get('x-vercel-ip-country-region'))
  const latStr = h.get('x-vercel-ip-latitude')
  const lngStr = h.get('x-vercel-ip-longitude')

  const latitude = latStr ? Number(latStr) : null
  const longitude = lngStr ? Number(lngStr) : null
  const available =
    latitude != null &&
    Number.isFinite(latitude) &&
    longitude != null &&
    Number.isFinite(longitude)

  return NextResponse.json({
    available,
    city,
    country,
    region,
    latitude,
    longitude,
  })
}
