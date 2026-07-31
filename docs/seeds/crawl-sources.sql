-- Discovery Agent — the source registry (Stage 3).
-- A persistent list of public pages the nightly discovery cron checks. Bulk-add
-- from the /admin/sources panel; each enabled row is crawled on schedule and its
-- finds land in the Event Radar review queue. Idempotent: safe to re-run.
-- Apply via Supabase Studio → SQL editor.
--
-- A source is any public URL:
--   • a LISTING page (a venue's "what's on", a ticketing catalog) → the agent
--     finds every event linked on it;
--   • a SINGLE event page → the agent imports/monitors that one event.
-- Whether new events flow in depends on the source being server-rendered (not a
-- JavaScript-only app); the panel shows each source's last-run yield so dead
-- sources are visible.

CREATE TABLE IF NOT EXISTS crawl_sources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  url              text NOT NULL,              -- the page as entered (post-normalize)
  normalized_url   text NOT NULL,              -- dedup key (tracking params stripped, host lowercased)
  label            text,                       -- optional human label; defaults to the host
  kind             text CHECK (kind IN ('venue','promoter','ticketing','listing','event')),

  enabled          boolean NOT NULL DEFAULT true,   -- crawled by the nightly cron when true

  -- Last-run telemetry (updated by the discovery run).
  last_run_at      timestamptz,
  last_found_count integer,                    -- how many NEW candidates this source produced last run
  last_status      text CHECK (last_status IN ('ok','error','empty')),

  created_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- One row per source (dedup + safe bulk re-add).
CREATE UNIQUE INDEX IF NOT EXISTS crawl_sources_normalized_url_key
  ON crawl_sources (normalized_url);

-- The cron pulls enabled sources; index the hot filter.
CREATE INDEX IF NOT EXISTS crawl_sources_enabled_idx
  ON crawl_sources (enabled, created_at DESC);

-- Admin-only, defence-in-depth. All server writes use the service-role client
-- (bypasses RLS); this ensures an anon/authed client can never read or mutate.
ALTER TABLE crawl_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crawl_sources' AND policyname = 'crawl_sources_admin_all'
  ) THEN
    CREATE POLICY crawl_sources_admin_all
      ON crawl_sources
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'crawl_sources'
ORDER BY ordinal_position;
