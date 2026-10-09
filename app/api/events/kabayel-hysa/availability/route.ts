import { NextResponse } from 'next/server'
import { getAvailability } from '@/lib/hysa/availability'

// Normalized ticket availability for /hysa (phase 44). Reads only an
// official feed when configured (see lib/hysa/availability.ts); otherwise
// reports "not_configured" and the page links to the official shop.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await getAvailability()
  return NextResponse.json(data, {
    headers: {
      // Short CDN cache only; the page fetches with no-store and shows the
      // data's own timestamp, so nothing old is presented as current.
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30',
    },
  })
}
