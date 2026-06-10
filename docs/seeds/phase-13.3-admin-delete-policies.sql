-- =============================================================================
-- Phase 13.3 — Admin DELETE policies for event_submissions
-- =============================================================================
-- The admin queue needs to hard-delete rejected / spam submissions so the
-- table doesn't grow forever. event_submissions had no admin DELETE policy
-- in the prior seeds, so this adds it.
--
-- The `events` table already allows admin DELETE via events_admin_write
-- (FOR ALL TO authenticated USING is_admin()), so no change needed there.
--
-- Idempotent — safe to re-run.
-- =============================================================================

DROP POLICY IF EXISTS "event_submissions_delete_admin" ON public.event_submissions;
CREATE POLICY "event_submissions_delete_admin"
  ON public.event_submissions
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Verify
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'event_submissions'
ORDER BY policyname;
