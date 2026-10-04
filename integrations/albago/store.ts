import type { SupabaseClient } from '@supabase/supabase-js'
import type { EngineStore, EntityRecord, ObservationRow, OccurrenceRecord, RunRecord, VenueRecord } from '@/engine'

/**
 * EngineStore over the `engine` Postgres schema (service-role client only).
 * This is AlbaGo's deployment choice; another deployment can implement the
 * same EngineStore over any Postgres.
 */

type Row = Record<string, unknown>

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`engine store: ${res.error.message}`)
  return res.data
}

function insertedId(res: { data: { id: unknown } | null; error: { message: string } | null }): string {
  const data = check(res)
  if (!data || typeof data.id !== 'string') throw new Error('engine store: insert returned no id')
  return data.id
}

const time5 = (t: unknown) => (typeof t === 'string' ? t.slice(0, 5) : null)

function toOccurrence(r: Row): OccurrenceRecord {
  return {
    id: r.id as string,
    version: r.version as number,
    title: r.title as string,
    description: (r.description as string) ?? null,
    language: (r.language as string) ?? null,
    event_type: r.event_type as OccurrenceRecord['event_type'],
    tags: (r.tags as string[]) ?? [],
    start: { date: r.start_date as string, time: time5(r.start_time), timezone: (r.timezone as string) ?? null },
    end: { date: (r.end_date as string) ?? null, time: time5(r.end_time) },
    status: r.status as OccurrenceRecord['status'],
    venue: { venue_id: (r.venue_id as string) ?? null, name: (r.venue_text as string) ?? null, address: (r.venue_address as string) ?? null },
    location: {
      locality: (r.locality as string) ?? null,
      country_code: (r.country_code as string)?.trim() ?? null,
      lat: (r.lat as number) ?? null,
      lng: (r.lng as number) ?? null,
    },
    organizer_name: (r.organizer_name as string) ?? null,
    performers: (r.performers as string[]) ?? [],
    promotion_languages: (r.promotion_languages as string[]) ?? [],
    audience_statements: (r.audience_statements as string[]) ?? [],
    cultural_occasion: (r.cultural_occasion as string) ?? null,
    price: r.price as OccurrenceRecord['price'],
    ticket_url: (r.ticket_url as string) ?? null,
    media: (r.media as OccurrenceRecord['media']) ?? [],
    source_urls: (r.source_urls as string[]) ?? [],
    provenance: (r.provenance as OccurrenceRecord['provenance']) ?? {},
    relevance: (r.relevance as OccurrenceRecord['relevance']) ?? {},
    review_status: r.review_status as OccurrenceRecord['review_status'],
    updated_at: new Date(r.updated_at as string).toISOString(),
    created_at: r.created_at as string,
    verified_at: (r.verified_at as string) ?? null,
    verified_by: (r.verified_by as string) ?? null,
  }
}

/** Occurrence fields (nested contract shape) → flat engine.occurrences columns. */
function fromOccurrence(o: Partial<OccurrenceRecord>): Row {
  const row: Row = {}
  const copy = ['version', 'title', 'description', 'language', 'event_type', 'tags', 'status', 'organizer_name', 'performers', 'promotion_languages', 'audience_statements', 'cultural_occasion', 'price', 'ticket_url', 'media', 'source_urls', 'provenance', 'relevance', 'review_status', 'verified_at', 'verified_by'] as const
  for (const k of copy) if (o[k] !== undefined) row[k] = o[k]
  if (o.start) Object.assign(row, { start_date: o.start.date, start_time: o.start.time, timezone: o.start.timezone })
  if (o.end) Object.assign(row, { end_date: o.end.date, end_time: o.end.time })
  if (o.venue) Object.assign(row, { venue_id: o.venue.venue_id, venue_text: o.venue.name, venue_address: o.venue.address })
  if (o.location) Object.assign(row, { locality: o.location.locality, country_code: o.location.country_code, lat: o.location.lat, lng: o.location.lng })
  return row
}

export function supabaseEngineStore(client: SupabaseClient): EngineStore {
  const db = () => client.schema('engine')

  return {
    runs: {
      async create(lane, goal, triggeredBy) {
        return insertedId(await db().from('runs').insert({ lane, goal, triggered_by: triggeredBy }).select('id').single())
      },
      async finish(id, patch) {
        check(await db().from('runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', id))
      },
      async get(id) {
        return (check(await db().from('runs').select('*').eq('id', id).maybeSingle()) as RunRecord | null) ?? null
      },
      async recent(limit) {
        return check(await db().from('runs').select('*').order('started_at', { ascending: false }).limit(limit)) as RunRecord[]
      },
    },

    sources: {
      async findByNormalizedUrl(normalizedUrl) {
        return (check(await db().from('sources').select('id, status').eq('normalized_url', normalizedUrl).maybeSingle()) as { id: string; status: string } | null) ?? null
      },
      async propose(input) {
        return insertedId(await db().from('sources').insert({ ...input, status: 'proposed' }).select('id').single())
      },
    },

    observations: {
      async findByUrlAndHash(normalizedUrl, contentHash) {
        return (check(await db().from('observations').select('*').eq('normalized_url', normalizedUrl).eq('content_hash', contentHash).maybeSingle()) as ObservationRow | null) ?? null
      },
      async insert(row) {
        return insertedId(await db().from('observations').insert(row).select('id').single())
      },
      async update(id, patch) {
        check(await db().from('observations').update(patch).eq('id', id))
      },
      async listForOccurrence(occurrenceId) {
        return check(await db().from('observations').select('*').eq('occurrence_id', occurrenceId).order('retrieved_at')) as ObservationRow[]
      },
      async countRecentForUrl(normalizedUrl) {
        const res = await db().from('observations').select('id', { count: 'exact', head: true }).eq('normalized_url', normalizedUrl)
        if (res.error) throw new Error(`engine store: ${res.error.message}`)
        return res.count ?? 0
      },
    },

    occurrences: {
      async insert(o) {
        return insertedId(await db().from('occurrences').insert(fromOccurrence(o)).select('id').single())
      },
      async update(id, patch) {
        check(await db().from('occurrences').update(fromOccurrence(patch)).eq('id', id))
      },
      async get(id) {
        const r = check(await db().from('occurrences').select('*').eq('id', id).maybeSingle()) as Row | null
        return r ? toOccurrence(r) : null
      },
      async findCandidates({ start_date, country_code, locality }) {
        let q = db().from('occurrences').select('*').eq('start_date', start_date).neq('review_status', 'rejected').limit(50)
        q = country_code ? q.eq('country_code', country_code) : q.is('country_code', null)
        if (locality) q = q.or(`locality.is.null,locality.ilike.${locality.replace(/[,%_()]/g, '')}`)
        return (check(await q) as Row[]).map(toOccurrence)
      },
      async findBySourceUrl(normalizedUrl) {
        const r = check(await db().from('occurrences').select('*').contains('source_urls', [normalizedUrl]).limit(1).maybeSingle()) as Row | null
        return r ? toOccurrence(r) : null
      },
      async listByReviewStatus(status, limit) {
        return (check(await db().from('occurrences').select('*').eq('review_status', status).order('start_date').limit(limit)) as Row[]).map(toOccurrence)
      },
    },

    venues: {
      async findInLocality(countryCode, locality) {
        let q = db().from('venues').select('id, name, aliases, address, locality, country_code, lat, lng').limit(200)
        q = countryCode ? q.eq('country_code', countryCode) : q.is('country_code', null)
        if (locality) q = q.ilike('locality', locality.replace(/[%_]/g, ''))
        return (check(await q) as VenueRecord[]).map((v) => ({ ...v, country_code: v.country_code?.trim() ?? null }))
      },
      async insert(row) {
        return insertedId(await db().from('venues').insert(row).select('id').single())
      },
    },

    entities: {
      async findAffiliated(names, affiliation) {
        if (names.length === 0) return []
        const rows = check(
          await db()
            .from('entities')
            .select('name, kind, aliases')
            .contains('affiliations', { [affiliation]: { state: 'confirmed' } })
            .limit(5000),
        ) as { name: string; kind: string; aliases: string[] }[]
        const wanted = new Set(names.map((n) => n.toLowerCase()))
        return rows.filter((e) => [e.name, ...(e.aliases ?? [])].some((n) => wanted.has(n.toLowerCase()))).map(({ name, kind }) => ({ name, kind }))
      },
      async list(kind, affiliation) {
        return check(
          await db().from('entities').select('id, kind, name, aliases, affiliations').eq('kind', kind).not(`affiliations->${affiliation}`, 'is', null).order('name').limit(5000),
        ) as EntityRecord[]
      },
      async findByName(kind, name) {
        const pattern = name.replace(/[\\%_]/g, (c) => `\\${c}`)
        const rows = check(await db().from('entities').select('id, kind, name, aliases, affiliations').eq('kind', kind).ilike('name', pattern).limit(1)) as EntityRecord[]
        return rows[0] ?? null
      },
      async insert(row) {
        return insertedId(await db().from('entities').insert(row).select('id').single())
      },
      async setAffiliation(id, affiliation, claim) {
        const current = check(await db().from('entities').select('affiliations').eq('id', id).single()) as { affiliations: Record<string, unknown> }
        check(await db().from('entities').update({ affiliations: { ...current.affiliations, [affiliation]: claim } }).eq('id', id))
      },
    },

    reviewActions: {
      async insert(row) {
        check(await db().from('review_actions').insert(row))
      },
    },
  }
}
