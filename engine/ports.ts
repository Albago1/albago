import type { LanguageModel } from 'ai'
import type { CanonicalOccurrenceV1 } from './contract/occurrence'
import type { ExtractionV1 } from './extract/extraction'

/**
 * The engine's plug-points to the outside world. A deployment (AlbaGo today,
 * another customer or a standalone service later) supplies implementations;
 * the engine never reaches for a database client, API key or env var itself.
 * Deliberately few: store, fetcher, reasoner, search, geocoder.
 */

/** Tool-capable LLM via the Vercel AI SDK — provider chosen by the deployment. */
export type Reasoner = {
  /** e.g. "google/gemini-flash-latest" — recorded on every observation and run. */
  id: string
  /** Model for the discovery agent (search, judge, decide). */
  agent: LanguageModel
  /** Model for reading one page into an extraction (high volume, can be lighter). */
  extractor: LanguageModel
}

export type SearchResult = { url: string; title: string; snippet: string; published?: string | null }

export type SearchProvider = {
  id: string
  search(query: string, opts: { maxResults: number; recencyDays?: number }): Promise<SearchResult[]>
}

export type FetchedPage = { url: string; finalUrl: string; status: number; contentType: string; html: string }

export type Fetcher = {
  /** SSRF-safe fetch of an HTML page; null on network error, non-HTML or non-2xx. */
  fetchHtml(url: string): Promise<FetchedPage | null>
}

export type Geocoder = {
  geocode(query: string, countryCode: string | null): Promise<{ lat: number; lng: number } | null>
}

// ---------------------------------------------------------------------------
// Persistence. Shapes mirror the `engine` schema (supabase/migrations/…_engine_schema.sql).
// ---------------------------------------------------------------------------

export type ObservationRow = {
  id: string
  source_id: string | null
  run_id: string | null
  connector: string
  source_url: string | null
  normalized_url: string | null
  retrieved_at: string
  content_hash: string
  evidence: unknown
  lead: unknown
  extracted: ExtractionV1 | null
  extractor: string | null
  status: 'extracted' | 'not_event' | 'failed'
  error: string | null
  occurrence_id: string | null
  match: MatchRecord | null
}

export type MatchRecord = {
  decision: 'new' | 'attached' | 'possible_duplicate' | 'skipped'
  score: number
  reasons: string[]
  candidate_ids: string[]
  decided_by: 'rule' | 'human'
}

/** An occurrence as stored: the canonical fields plus bookkeeping. */
export type OccurrenceRecord = Omit<CanonicalOccurrenceV1, 'contract'> & {
  verified_at: string | null
  verified_by: string | null
  created_at: string
}

export type VenueRecord = {
  id: string
  name: string
  aliases: string[]
  address: string | null
  locality: string | null
  country_code: string | null
  lat: number | null
  lng: number | null
}

/**
 * A claim that an entity belongs to a community/affiliation (e.g. "albanian").
 * Only `confirmed` claims count as relevance evidence; `candidate` waits for a
 * human; `rejected` is remembered so it is never proposed again.
 */
export type AffiliationClaim = {
  state: 'confirmed' | 'candidate' | 'rejected'
  /** Where the claim came from: 'config', 'learned', 'review'. */
  source: string
  since: string
  actor?: string | null
  /** Occurrences the entity was seen in (learned claims), newest first, capped. */
  evidence?: Array<{ occurrence_id: string; title: string }>
}

export type EntityRecord = {
  id: string
  kind: 'performer' | 'organizer' | 'institution'
  name: string
  aliases: string[]
  affiliations: Record<string, AffiliationClaim>
}

export type RunRecord = {
  id: string
  lane: 'research' | 'monitoring' | 'direct' | 'manual'
  status: 'running' | 'completed' | 'failed' | 'stopped_budget'
  goal: unknown
  stats: Record<string, number>
  log: unknown[]
  started_at: string
  finished_at: string | null
  error: string | null
}

export type EngineStore = {
  runs: {
    create(lane: RunRecord['lane'], goal: unknown, triggeredBy: string | null): Promise<string>
    finish(id: string, patch: Pick<RunRecord, 'status' | 'stats' | 'log' | 'error'>): Promise<void>
    get(id: string): Promise<RunRecord | null>
    recent(limit: number): Promise<RunRecord[]>
  }
  sources: {
    findByNormalizedUrl(normalizedUrl: string): Promise<{ id: string; status: string } | null>
    propose(input: { connector: string; url: string; normalized_url: string; label: string | null; scope: unknown; discovered_by_run: string | null; evaluation: unknown }): Promise<string>
  }
  observations: {
    findByUrlAndHash(normalizedUrl: string, contentHash: string): Promise<ObservationRow | null>
    insert(row: Omit<ObservationRow, 'id'>): Promise<string>
    update(id: string, patch: Partial<Pick<ObservationRow, 'occurrence_id' | 'match' | 'status' | 'error'>>): Promise<void>
    listForOccurrence(occurrenceId: string): Promise<ObservationRow[]>
    countRecentForUrl(normalizedUrl: string): Promise<number>
  }
  occurrences: {
    insert(row: Omit<OccurrenceRecord, 'id' | 'created_at' | 'updated_at' | 'verified_at' | 'verified_by'>): Promise<string>
    update(id: string, patch: Partial<OccurrenceRecord>): Promise<void>
    get(id: string): Promise<OccurrenceRecord | null>
    /** Same start date and country (and locality when known) — the dedup block. */
    findCandidates(q: { start_date: string; country_code: string | null; locality: string | null }): Promise<OccurrenceRecord[]>
    findBySourceUrl(normalizedUrl: string): Promise<OccurrenceRecord | null>
    listByReviewStatus(status: OccurrenceRecord['review_status'], limit: number): Promise<OccurrenceRecord[]>
  }
  venues: {
    findInLocality(countryCode: string | null, locality: string | null): Promise<VenueRecord[]>
    insert(row: Omit<VenueRecord, 'id'> & { created_from_observation: string | null }): Promise<string>
  }
  entities: {
    /** Entities among `names` (or their aliases) with a CONFIRMED claim for the affiliation. */
    findAffiliated(names: string[], affiliation: string): Promise<{ name: string; kind: string }[]>
    /** Every entity of a kind with any claim (confirmed, candidate, rejected) for the affiliation. */
    list(kind: EntityRecord['kind'], affiliation: string): Promise<EntityRecord[]>
    findByName(kind: EntityRecord['kind'], name: string): Promise<EntityRecord | null>
    insert(row: Omit<EntityRecord, 'id'>): Promise<string>
    setAffiliation(id: string, affiliation: string, claim: AffiliationClaim): Promise<void>
  }
  reviewActions: {
    insert(row: { occurrence_id: string | null; observation_id: string | null; action: string; changes: unknown; reason: string | null; actor: string | null }): Promise<void>
  }
}

export type EngineLog = (event: string, detail?: Record<string, unknown>) => void

export type EngineDeps = {
  store: EngineStore
  fetcher: Fetcher
  reasoner: Reasoner
  search: SearchProvider
  geocoder?: Geocoder
  now?: () => Date
  log?: EngineLog
}
