-- Phase 8.3 — Extend event_submissions with civic columns + coordinates.
-- Idempotent: safe to re-run. Apply via Supabase Studio → SQL editor.
--
-- Why: Phase 8.1 added civic columns to `events`, but `event_submissions`
-- (the community submission queue) was never extended. So a user submitting a
-- protest via /submit-event had no way to record telegram/whatsapp/safety
-- notes/expected attendees, and admin approval had nothing to copy into
-- `events`. This migration closes that gap.

ALTER TABLE event_submissions
  ADD COLUMN IF NOT EXISTS event_type             text,
  ADD COLUMN IF NOT EXISTS is_civic               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_movement_slug text,
  ADD COLUMN IF NOT EXISTS organizer_contact      text,
  ADD COLUMN IF NOT EXISTS telegram_link          text,
  ADD COLUMN IF NOT EXISTS whatsapp_link          text,
  ADD COLUMN IF NOT EXISTS safety_notes           text,
  ADD COLUMN IF NOT EXISTS expected_attendees     integer,
  ADD COLUMN IF NOT EXISTS lat                    double precision,
  ADD COLUMN IF NOT EXISTS lng                    double precision;

-- Match the events.event_type CHECK constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_submissions_event_type_check'
  ) THEN
    ALTER TABLE event_submissions
      ADD CONSTRAINT event_submissions_event_type_check
      CHECK (
        event_type IS NULL OR event_type IN (
          'protest', 'civic_gathering', 'movement_event', 'demonstration'
        )
      );
  END IF;
END $$;

-- Index for admin "civic" tab filtering.
CREATE INDEX IF NOT EXISTS event_submissions_is_civic_idx
  ON event_submissions (is_civic, created_at DESC)
  WHERE is_civic = true;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'event_submissions'
  AND column_name IN (
    'event_type','is_civic','featured_movement_slug','organizer_contact',
    'telegram_link','whatsapp_link','safety_notes','expected_attendees','lat','lng'
  )
ORDER BY column_name;
