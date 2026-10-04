import type { EngineStore, ObservationRow, OccurrenceRecord, RunRecord, VenueRecord } from '@/engine'

/** In-memory EngineStore for pipeline tests — same contract as the Supabase store. */
export function memoryStore() {
  let n = 0
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const runs = new Map<string, RunRecord>()
  const observations = new Map<string, ObservationRow>()
  const occurrences = new Map<string, OccurrenceRecord>()
  const venues = new Map<string, VenueRecord>()
  const sources = new Map<string, { id: string; status: string; normalized_url: string }>()
  const reviewActions: unknown[] = []
  const entities: { name: string; kind: string; affiliation: string }[] = []
  const nowIso = () => new Date().toISOString()

  const store: EngineStore = {
    runs: {
      async create(lane, goal) {
        const rid = id()
        runs.set(rid, { id: rid, lane, goal, status: 'running', stats: {}, log: [], started_at: nowIso(), finished_at: null, error: null })
        return rid
      },
      async finish(rid, patch) {
        runs.set(rid, { ...runs.get(rid)!, ...patch, finished_at: nowIso() })
      },
      async get(rid) {
        return runs.get(rid) ?? null
      },
      async recent(limit) {
        return [...runs.values()].slice(-limit)
      },
    },
    sources: {
      async findByNormalizedUrl(u) {
        return [...sources.values()].find((s) => s.normalized_url === u) ?? null
      },
      async propose(input) {
        const sid = id()
        sources.set(sid, { id: sid, status: 'proposed', normalized_url: input.normalized_url })
        return sid
      },
    },
    observations: {
      async findByUrlAndHash(u, h) {
        return [...observations.values()].find((o) => o.normalized_url === u && o.content_hash === h) ?? null
      },
      async insert(row) {
        const oid = id()
        observations.set(oid, { ...row, id: oid })
        return oid
      },
      async update(oid, patch) {
        observations.set(oid, { ...observations.get(oid)!, ...patch })
      },
      async listForOccurrence(occ) {
        return [...observations.values()].filter((o) => o.occurrence_id === occ)
      },
      async countRecentForUrl(u) {
        return [...observations.values()].filter((o) => o.normalized_url === u).length
      },
    },
    occurrences: {
      async insert(row) {
        const oid = id()
        occurrences.set(oid, { ...row, id: oid, created_at: nowIso(), updated_at: nowIso(), verified_at: null, verified_by: null })
        return oid
      },
      async update(oid, patch) {
        occurrences.set(oid, { ...occurrences.get(oid)!, ...patch, updated_at: nowIso() })
      },
      async get(oid) {
        return occurrences.get(oid) ?? null
      },
      async findCandidates(q) {
        return [...occurrences.values()].filter(
          (o) =>
            o.start.date === q.start_date &&
            o.location.country_code === q.country_code &&
            (!q.locality || !o.location.locality || o.location.locality.toLowerCase() === q.locality.toLowerCase()),
        )
      },
      async findBySourceUrl(u) {
        return [...occurrences.values()].find((o) => o.source_urls.includes(u)) ?? null
      },
      async listByReviewStatus(status, limit) {
        return [...occurrences.values()].filter((o) => o.review_status === status).slice(0, limit)
      },
    },
    venues: {
      async findInLocality(cc, loc) {
        return [...venues.values()].filter((v) => v.country_code === cc && (!loc || v.locality === loc))
      },
      async insert(row) {
        const vid = id()
        venues.set(vid, { id: vid, name: row.name, aliases: row.aliases, address: row.address, locality: row.locality, country_code: row.country_code, lat: row.lat, lng: row.lng })
        return vid
      },
    },
    entities: {
      async findAffiliated(names, affiliation) {
        const wanted = new Set(names.map((x) => x.toLowerCase()))
        return entities.filter((e) => e.affiliation === affiliation && wanted.has(e.name.toLowerCase())).map(({ name, kind }) => ({ name, kind }))
      },
    },
    reviewActions: {
      async insert(row) {
        reviewActions.push(row)
      },
    },
  }
  return { store, observations, occurrences, venues, reviewActions, entities, runs, sources }
}
