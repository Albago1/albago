import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanonicalOccurrenceV1 } from '@/engine'
import { ALBAGO_CATEGORY, deliveryDecision } from './policy'

/**
 * AlbaGo OutputAdapter: verified canonical occurrence → public.events row.
 * Idempotent on engine_occurrence_id (one AlbaGo event per occurrence; a newer
 * engine version updates it in place). Server-side, service-role client, one
 * statement per delivery. AlbaGo naming/slugs/categories live here only.
 */

const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' })

/** Canonical locality → AlbaGo location_slug ("Tirana" → "tirana", "Durrës" → "durres"). */
export function albagoLocationSlug(locality: string): string {
  return locality
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function slugify(title: string): string {
  return albagoLocationSlug(title).slice(0, 70).replace(/-+$/, '') || 'event'
}

function priceText(o: CanonicalOccurrenceV1): string | null {
  const p = o.price
  if (p.state === 'free') return 'Free'
  if (p.state === 'paid' && p.min != null && p.currency) {
    const fmt = (n: number) => new Intl.NumberFormat('en', { style: 'currency', currency: p.currency!, maximumFractionDigits: 2 }).format(n)
    return p.max != null && p.max > p.min ? `${fmt(p.min)} – ${fmt(p.max)}` : fmt(p.min)
  }
  return null // unknown price: AlbaGo shows "Price not announced", never "Unknown"
}

/** The public.events row for a verified occurrence. Pure — unit-tested. */
export function toAlbagoEventRow(o: CanonicalOccurrenceV1, verifiedAt: string | null) {
  const category = ALBAGO_CATEGORY[o.event_type]!
  return {
    engine_occurrence_id: o.id,
    engine_version: o.version,
    title: o.title,
    description: o.description ?? '',
    category,
    date: o.start.date,
    time: o.start.time!,
    end_date: o.end.date,
    end_time: o.end.time,
    timezone: o.start.timezone,
    status: o.status === 'postponed' ? 'postponed' : 'published',
    listing_status: o.status === 'rescheduled' ? 'updated' : o.status === 'postponed' ? 'postponed' : 'confirmed',
    location_slug: albagoLocationSlug(o.location.locality!),
    country: COUNTRY_NAMES.of(o.location.country_code!) ?? o.location.country_code!,
    address: o.venue.address,
    lat: o.location.lat,
    lng: o.location.lng,
    organizer_name: o.organizer_name,
    tags: o.tags,
    language: o.language,
    price: priceText(o),
    price_from_cents: o.price.state === 'paid' && o.price.min != null ? Math.round(o.price.min * 100) : o.price.state === 'free' ? 0 : null,
    price_currency: o.price.state === 'paid' ? o.price.currency : null,
    ticket_url: o.ticket_url,
    official_source_url: o.source_urls[0] ?? null,
    last_verified_at: verifiedAt,
    origin: 'imported',
    // Images: source posters have rights 'unknown' — not hotlinked or copied (media class 4 decision).
    banner_url: null,
  }
}

export type DeliveryResult = { delivered: true; eventId: string; slug: string; updated: boolean } | { delivered: false; reasons: string[] }

export async function deliverToAlbago(client: SupabaseClient, o: CanonicalOccurrenceV1, verifiedAt: string | null): Promise<DeliveryResult> {
  const decision = deliveryDecision(o)
  if (!decision.deliver) return { delivered: false, reasons: decision.reasons }

  const existing = await client.from('events').select('id, slug, engine_version').eq('engine_occurrence_id', o.id).maybeSingle()
  if (existing.error) throw new Error(`albago adapter: ${existing.error.message}`)
  const row = toAlbagoEventRow(o, verifiedAt)

  if (existing.data) {
    if ((existing.data.engine_version ?? 0) >= o.version) {
      return { delivered: true, eventId: existing.data.id, slug: existing.data.slug, updated: false }
    }
    const upd = await client.from('events').update({ ...row, updated_at: new Date().toISOString() }).eq('id', existing.data.id)
    if (upd.error) throw new Error(`albago adapter: ${upd.error.message}`)
    return { delivered: true, eventId: existing.data.id, slug: existing.data.slug, updated: true }
  }

  const slug = `${slugify(o.title)}-${o.id.slice(0, 8)}`
  const ins = await client
    .from('events')
    .insert({ ...row, slug, published_at: new Date().toISOString() })
    .select('id, slug')
    .single()
  if (ins.error) throw new Error(`albago adapter: ${ins.error.message}`)
  return { delivered: true, eventId: ins.data.id as string, slug: ins.data.slug as string, updated: false }
}

/** Retract: unpublish (never delete) the AlbaGo event delivered for an occurrence. */
export async function retractFromAlbago(client: SupabaseClient, occurrenceId: string): Promise<void> {
  const res = await client.from('events').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('engine_occurrence_id', occurrenceId)
  if (res.error) throw new Error(`albago adapter: ${res.error.message}`)
}
