-- RADAR-1 — Event Intelligence System, Phase 1.
-- A staging/evidence table for admin URL imports (the "Event Radar" surface).
-- Idempotent: safe to re-run. Apply via Supabase Studio → SQL editor.
--
-- Why a NEW table instead of reusing event_submissions:
--   event_submissions is the FROZEN moderation-queue shape (schema rule #8) and
--   has nowhere to hold import evidence — the source URL, the normalized dedup
--   key, the raw extracted reading, the transparent warnings/missing-fields, or
--   the processing/failed lifecycle states. This table is NOT a second event
--   system: it is an inbox that, on approval, writes a normal `pending`
--   event_submissions row via the SAME crawlReadingToSubmission mapping the
--   crawler uses, so approved candidates flow into the existing Queue → publish
--   pipeline unchanged.
--
-- Lifecycle: processing → needs_review → approved | rejected | failed.

CREATE TABLE IF NOT EXISTS event_import_candidates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source evidence (§11).
  source_url       text NOT NULL,                 -- the URL the admin pasted / final after redirects
  normalized_url   text NOT NULL,                 -- dedup key (tracking params stripped, host lowercased)
  source_name      text,                          -- host without www, for display
  image_url        text,                          -- og:image / poster reference (reviewable link only)
  parser_version   text,                          -- extraction pipeline version for provenance

  -- Lifecycle (§9).
  status           text NOT NULL DEFAULT 'needs_review'
                     CHECK (status IN ('processing','needs_review','approved','rejected','failed')),
  error            text,                           -- populated only for status='failed'

  -- Transparent assessment (§8) — a label, never a mysterious score.
  confidence       text CHECK (confidence IN ('high','medium','low')),
  warnings         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{code,message}]
  missing_fields   jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ["date","venue",...]

  -- Extracted draft + resolution (the editable candidate, §6).
  reading          jsonb,                          -- full PosterReading
  resolution       jsonb,                          -- LensResolution summary (city/venue/geocode/duplicate)

  -- Denormalized for the list view (kept in sync on write).
  title            text,
  event_date       text,
  venue_name       text,
  city_label       text,
  country          text,

  -- Duplicate signal (§12) surfaced from the resolution.
  duplicate_status     text CHECK (duplicate_status IN ('live','in_review','none')),
  duplicate_event_slug text,

  -- Hand-off + audit (§9, §14).
  submission_id    uuid,                           -- the event_submissions row created on approval
  admin_note       text,
  imported_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- One candidate per source (§4.9, §12): the dedup + idempotent-retry guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS event_import_candidates_normalized_url_key
  ON event_import_candidates (normalized_url);

CREATE INDEX IF NOT EXISTS event_import_candidates_status_idx
  ON event_import_candidates (status, created_at DESC);

-- Admin-only. All server writes go through the service-role client (bypasses
-- RLS); this policy is defence-in-depth so an anon/authed client can never read
-- or mutate candidates directly. Mirrors the role guard used across /admin.
ALTER TABLE event_import_candidates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_import_candidates'
      AND policyname = 'event_import_candidates_admin_all'
  ) THEN
    CREATE POLICY event_import_candidates_admin_all
      ON event_import_candidates
      FOR ALL
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;
END $$;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'event_import_candidates'
ORDER BY ordinal_position;
