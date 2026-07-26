import type { PosterReading } from '@/lib/ai/posterReader'
import type { LensResolution } from '@/lib/lens/resolve'
import type { RadarAssessment, RadarConfidence, RadarWarning } from './assess'

/**
 * Event Radar (RADAR-1) candidate shape + row-building. Pure — no I/O.
 *
 * A candidate is the reviewable draft that lives in event_import_candidates. It
 * carries the full extracted reading (editable), the full resolution + the
 * assessment, and the source evidence. On approval it is mapped into a normal
 * event_submissions row via the crawler's own crawlReadingToSubmission (see
 * service.ts) — which needs the complete resolution (city slug, venue coords),
 * so the whole LensResolution is stored, not a lossy summary. This file never
 * touches the DB.
 */

// Bump when the extraction/assessment pipeline changes materially, so stored
// candidates carry the provenance of how they were read (spec §11).
export const RADAR_PARSER_VERSION = 'radar-1'

export type CandidateStatus =
  | 'processing'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'failed'

/** A row of event_import_candidates as read back by the admin UI. */
export type EventImportCandidate = {
  id: string
  source_url: string
  normalized_url: string
  source_name: string | null
  image_url: string | null
  parser_version: string | null
  status: CandidateStatus
  error: string | null
  confidence: RadarConfidence | null
  warnings: RadarWarning[]
  missing_fields: string[]
  reading: PosterReading | null
  resolution: LensResolution | null
  title: string | null
  event_date: string | null
  venue_name: string | null
  city_label: string | null
  country: string | null
  duplicate_status: 'live' | 'in_review' | 'none' | null
  duplicate_event_slug: string | null
  submission_id: string | null
  admin_note: string | null
  imported_by: string | null
  decided_by: string | null
  created_at: string
  updated_at: string
}

/** The columns written to event_import_candidates for a successful read.
 *  `source_url` / `normalized_url` / `imported_by` are supplied by the caller. */
export function buildCandidateWrite(args: {
  reading: PosterReading
  resolution: LensResolution
  assessment: RadarAssessment
  imageUrl: string | null
  sourceName: string | null
}) {
  const { reading, resolution, assessment, imageUrl, sourceName } = args
  return {
    status: 'needs_review' as CandidateStatus,
    error: null as string | null,
    parser_version: RADAR_PARSER_VERSION,
    source_name: sourceName,
    image_url: imageUrl,
    confidence: assessment.confidence,
    warnings: assessment.warnings,
    missing_fields: assessment.missingFields,
    reading,
    resolution,
    // Denormalized for the list view — resolved entities win over raw text so
    // the queue shows the canonical city/venue, matching the crawler.
    title: reading.title || null,
    event_date: reading.date || null,
    venue_name: resolution.venue.place?.name || reading.venue_name || null,
    city_label: resolution.city.label || reading.city || null,
    country: resolution.city.country || reading.country || null,
    duplicate_status: resolution.duplicate.status,
    duplicate_event_slug: resolution.duplicate.event?.slug ?? null,
    updated_at: new Date().toISOString(),
  }
}
