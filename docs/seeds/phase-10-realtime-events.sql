-- Phase 10 — enable Supabase Realtime on public.events.
-- Powers the /protests page live updates (auto-render when admin publishes).
-- Idempotent: safe to re-run.
--
-- If the publication already includes events, the ALTER returns
-- "relation is already member of publication" — that is harmless. The DO
-- block below avoids the error and reports the final state.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
END $$;

-- Verify
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'events';
