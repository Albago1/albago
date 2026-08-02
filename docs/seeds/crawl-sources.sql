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

-- Idempotent without a DO/$$ block (the $$ quoting is fragile when pasted into
-- the Supabase SQL editor): drop-then-create is safe to re-run.
DROP POLICY IF EXISTS crawl_sources_admin_all ON crawl_sources;
CREATE POLICY crawl_sources_admin_all
  ON crawl_sources
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ── Curated starter sources ────────────────────────────────────────────────
-- Vetted 2026-08-01 against the actual crawler (lib/crawl/discover.ts): each is
-- SERVER-RENDERED (not a JS-only app), yields clean event-detail links, AND its
-- detail pages are fetch-readable so the Lens URL reader can extract them. Most
-- Albanian venue sites are JS/Wix/Facebook and yield nothing to a fetch crawler,
-- so this list is deliberately small and high-signal — grow it via /admin/sources
-- using "Run all now" to vet each new source's real-run yield before trusting it.
--   • gowild.al        — ticketing aggregator, Tirana + Kosovo (~15 events/crawl)
--   • enterevents.al   — festival ticketing (Sunny Hill, Panorama, …)
--   • event.bna.al     — Albanian business-network conferences (diaspora: Berlin/London/Tirana)
-- normalized_url mirrors lib/radar/normalizeUrl.ts so the panel/cron dedup on it.
-- Idempotent: ON CONFLICT keeps re-runs safe. Pause any row from the panel.
INSERT INTO crawl_sources (url, normalized_url, label, kind, enabled) VALUES
  ('https://gowild.al/',              'https://gowild.al/',              'gowild.al',      'ticketing', true),
  ('https://enterevents.al/events',   'https://enterevents.al/events',   'enterevents.al', 'ticketing', true),
  ('https://event.bna.al/en/eventet', 'https://event.bna.al/en/eventet', 'event.bna.al',   'promoter',  true)
ON CONFLICT (normalized_url) DO NOTHING;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'crawl_sources'
ORDER BY ordinal_position;

-- Confirm the seeded sources
SELECT label, kind, enabled, url FROM crawl_sources ORDER BY created_at;
