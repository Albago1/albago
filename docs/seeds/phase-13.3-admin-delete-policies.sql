-- =============================================================================
-- Phase 13.3 — Admin DELETE policies for event_submissions (NO-OP)
-- =============================================================================
-- Originally added an event_submissions_delete_admin policy, but the table
-- already had a `submissions_admin_delete` policy with the same is_admin()
-- gate. This file is now a no-op kept for historical reference — applying
-- it again will simply ensure the legacy policy stays in place.
--
-- The `events` table allows admin DELETE via events_admin_write
-- (FOR ALL TO authenticated USING is_admin()), so no change needed there.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- If a duplicate policy snuck in during an earlier run of this file, drop it
-- so the clean set is just submissions_admin_delete + friends.
DROP POLICY IF EXISTS "event_submissions_delete_admin" ON public.event_submissions;

-- Defensively ensure the canonical admin-delete policy exists.
DROP POLICY IF EXISTS "submissions_admin_delete" ON public.event_submissions;
CREATE POLICY "submissions_admin_delete"
  ON public.event_submissions
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Verify
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'event_submissions'
ORDER BY policyname;
