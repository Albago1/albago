-- Phase 34 — internal post provenance.
--
-- Problem: the public "organizer" name on a community submission is a FREE-TEXT
-- field. A signed-in user can type the real promoter's name (not their own) and
-- the event shows that name — so the display name proves nothing about who
-- actually posted it. Every submission DOES capture the real posting account
-- (event_submissions.submitted_by_user_id), but that link was dropped when the
-- submission was approved into `events`, so published events lost the trail.
--
-- This migration:
--   1. Adds events.submitted_by_user_id so the real poster survives approval.
--   2. Backfills already-published community events from their approved
--      submissions (conservative: only where exactly one submitter matches).
--   3. Adds admin_user_emails(uuid[]) so the admin UI can resolve poster IDs to
--      real auth-account emails (auth.users is not reachable from the browser).
--
-- Internal/audit only — submitted_by_user_id is NEVER exposed publicly.
-- Idempotent; safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Retain the real posting account on published events.
--    Organizer-dashboard events already carry organizer_id (= the auth user
--    id); this column covers community submissions and imports.
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS submitted_by_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.submitted_by_user_id IS
  'Real auth account that originally posted this event (community submissions + imports). Organizer-created events use organizer_id. Internal audit only, never exposed publicly.';

CREATE INDEX IF NOT EXISTS events_submitted_by_user_id_idx
  ON public.events (submitted_by_user_id)
  WHERE submitted_by_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Best-effort backfill for events already published before this migration.
--    Match each community event to its still-existing approved submission on
--    (title, date). Only backfill when exactly ONE distinct submitter matches,
--    so an ambiguous title+date pair is left NULL rather than mis-attributed.
-- ---------------------------------------------------------------------------
UPDATE public.events e
SET submitted_by_user_id = m.uid
FROM (
  SELECT
    lower(trim(title))                        AS t,
    date                                      AS d,
    (array_agg(DISTINCT submitted_by_user_id))[1] AS uid,
    count(DISTINCT submitted_by_user_id)      AS n
  FROM public.event_submissions
  WHERE status = 'approved'
    AND submitted_by_user_id IS NOT NULL
  GROUP BY lower(trim(title)), date
) m
WHERE e.submitted_by_user_id IS NULL
  AND e.origin = 'community_submission'
  AND lower(trim(e.title)) = m.t
  AND e.date = m.d
  AND m.n = 1;

-- ---------------------------------------------------------------------------
-- 3. Resolve a set of user IDs to their real auth-account emails.
--    auth.users is owned by supabase_auth_admin and unreachable from the anon
--    / authenticated roles directly, so this is SECURITY DEFINER + is_admin().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_emails(p_ids uuid[])
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email::text
    FROM auth.users u
    WHERE u.id = ANY(p_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_emails(uuid[]) TO authenticated;

COMMIT;

-- Expected: ALTER + backfill run clean, admin_user_emails present.
-- Verify:  SELECT count(*) FROM events WHERE submitted_by_user_id IS NOT NULL;
