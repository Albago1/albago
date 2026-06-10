-- Phase 9.1 — admin SELECT + UPDATE RLS policies on volunteer_signups.
-- Public submission (anon INSERT) was added in phase-9-volunteer-signups.sql.
-- This block lets admins read the list and update statuses (new -> contacted
-- -> confirmed/declined) from /admin/volunteers.
-- Idempotent: safe to re-run.

ALTER TABLE volunteer_signups ENABLE ROW LEVEL SECURITY;

-- Admin SELECT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volunteer_signups'
      AND policyname = 'volunteer_signups_select_admin'
  ) THEN
    DROP POLICY volunteer_signups_select_admin ON volunteer_signups;
  END IF;
END $$;

CREATE POLICY volunteer_signups_select_admin
  ON volunteer_signups FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin UPDATE (status + admin_note only — clients should not relax this)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volunteer_signups'
      AND policyname = 'volunteer_signups_update_admin'
  ) THEN
    DROP POLICY volunteer_signups_update_admin ON volunteer_signups;
  END IF;
END $$;

CREATE POLICY volunteer_signups_update_admin
  ON volunteer_signups FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Status CHECK constraint so the admin UI cannot write garbage statuses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'volunteer_signups_status_check'
  ) THEN
    ALTER TABLE volunteer_signups
      ADD CONSTRAINT volunteer_signups_status_check
      CHECK (status IN ('new', 'contacted', 'confirmed', 'declined'));
  END IF;
END $$;

-- Verify
SELECT policyname, cmd, roles FROM pg_policies
WHERE tablename = 'volunteer_signups'
ORDER BY policyname;
