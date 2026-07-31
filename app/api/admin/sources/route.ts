import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import {
  listSources,
  addSources,
  setSourceEnabled,
  deleteSource,
} from '@/lib/crawl/sourceStore'

/**
 * Source registry admin API. Admin session required on every verb.
 *   GET                         → { ok, sources }
 *   POST   { urls: string[] }   → { ok, added, duplicates, invalid }  (bulk add)
 *   PATCH  { id, enabled }      → { ok }                              (toggle)
 *   DELETE { id }               → { ok }                              (remove)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_URLS_PER_ADD = 1000
const MAX_URL_LEN = 2048

export async function GET() {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const sources = await listSources()
  return NextResponse.json({ ok: true, sources })
}

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  let body: { urls?: unknown }
  try {
    body = (await request.json()) as { urls?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  if (!Array.isArray(body.urls)) {
    return NextResponse.json({ ok: false, error: 'urls_required' }, { status: 400 })
  }
  const urls = body.urls
    .filter((u): u is string => typeof u === 'string')
    .map((u) => u.slice(0, MAX_URL_LEN))
    .slice(0, MAX_URLS_PER_ADD)

  const createdBy = await currentUserId()
  const result = await addSources(urls, createdBy)
  return NextResponse.json({ ok: true, ...result })
}

export async function PATCH(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  let body: { id?: unknown; enabled?: unknown }
  try {
    body = (await request.json()) as { id?: unknown; enabled?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  if (typeof body.id !== 'string' || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'bad_input' }, { status: 400 })
  }
  const ok = await setSourceEnabled(body.id, body.enabled)
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 })
}

export async function DELETE(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  let body: { id?: unknown }
  try {
    body = (await request.json()) as { id?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  if (typeof body.id !== 'string') {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }
  const ok = await deleteSource(body.id)
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 })
}
