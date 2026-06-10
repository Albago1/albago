-- Phase 9 — volunteer_signups table + anon INSERT policy.
-- Idempotent: safe to re-run. Apply via Supabase Studio → SQL editor.

CREATE TABLE IF NOT EXISTS volunteer_signups (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  name              text          NOT NULL,
  email             text          NOT NULL,
  phone             text,
  city              text          NOT NULL,
  country           text,
  roles             text[]        NOT NULL,
  availability_note text,
  movement_slug     text,
  status            text          NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS volunteer_signups_created_idx
  ON volunteer_signups (created_at DESC);

CREATE INDEX IF NOT EXISTS volunteer_signups_status_idx
  ON volunteer_signups (status);

CREATE INDEX IF NOT EXISTS volunteer_signups_movement_idx
  ON volunteer_signups (movement_slug)
  WHERE movement_slug IS NOT NULL;

ALTER TABLE volunteer_signups ENABLE ROW LEVEL SECURITY;

-- Drop-and-recreate is safer than CREATE POLICY IF NOT EXISTS, which Postgres
-- does not support before v15. We use DO blocks to stay portable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volunteer_signups'
      AND policyname = 'Public can submit volunteer signups'
  ) THEN
    DROP POLICY "Public can submit volunteer signups" ON volunteer_signups;
  END IF;
END $$;

CREATE POLICY "Public can submit volunteer signups"
  ON volunteer_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Verify
SELECT COUNT(*) AS volunteer_signups_count FROM volunteer_signups;
