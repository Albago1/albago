-- =============================================================================
-- Phase 13.1 — Tighten the public events SELECT policy
-- =============================================================================
-- Replaces the broad "anyone can read all events" policy with one that only
-- exposes published rows. Owner + admin policies (if any) are NOT touched —
-- this is purely about anonymous + general authenticated traffic.
--
-- Drops a known set of old policy names (each guarded by IF EXISTS so this is
-- safe to re-run). Then ensures events_select_published exists with the right
-- filter. If you've already applied a Phase 7B variant of this policy, this
-- script is a no-op for that policy.
-- =============================================================================

-- Drop any of the older broad-select policies, by every name they might have.
DROP POLICY IF EXISTS "events_select_all" ON public.events;
DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
DROP POLICY IF EXISTS "Public events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "events select all" ON public.events;
DROP POLICY IF EXISTS "public_events_read" ON public.events;

-- Ensure the strict published-only policy exists. If a previous Phase 7B
-- migration already created it, we drop + recreate to guarantee the filter.
DROP POLICY IF EXISTS "events_select_published" ON public.events;
CREATE POLICY "events_select_published"
  ON public.events
  FOR SELECT
  USING (status = 'published');

-- Confirm RLS is on (idempotent — no error if already enabled).
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Verify: should list events_select_published plus any owner/admin policies
-- you've already applied via Phase 7B.
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'events'
ORDER BY policyname;
