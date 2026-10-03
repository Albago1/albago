-- Phase 41 — take protest / civic content offline (2026-10-03)
--
-- Run in the Supabase SQL editor BEFORE deploying the remove-protests
-- branch: the new code no longer filters civic events out of public lists,
-- so any still-published protest would show up as a normal event.
--
-- Nothing is deleted. Published protests become drafts (invisible to the
-- public), pending protest submissions are rejected, and every touched row
-- is tagged in admin_note so the change can be undone (see section 4).

-- 1) DRY RUN — what will change
SELECT 'events' AS tbl, status, count(*)
FROM events
WHERE is_civic = true OR category = 'civic'
GROUP BY status
UNION ALL
SELECT 'event_submissions', status, count(*)
FROM event_submissions
WHERE is_civic = true OR category = 'civic'
GROUP BY status
ORDER BY 1, 2;

-- 2) CHANGE — one transaction
BEGIN;

UPDATE events
SET status     = 'draft',
    admin_note = concat_ws(' | ', admin_note, 'Phase 41: protest removed from public site'),
    updated_at = now()
WHERE (is_civic = true OR category = 'civic')
  AND status = 'published';

UPDATE event_submissions
SET status     = 'rejected',
    admin_note = concat_ws(' | ', admin_note, 'Phase 41: protests are no longer listed')
WHERE (is_civic = true OR category = 'civic')
  AND status = 'pending';

COMMIT;

-- 3) VERIFY — both must return 0
SELECT count(*) AS published_protests
FROM events
WHERE status = 'published' AND (is_civic = true OR category = 'civic');

SELECT count(*) AS pending_protest_submissions
FROM event_submissions
WHERE status = 'pending' AND (is_civic = true OR category = 'civic');

-- 4) UNDO (only if ever needed)
-- UPDATE events
-- SET status = 'published'
-- WHERE status = 'draft'
--   AND admin_note LIKE '%Phase 41: protest removed from public site%';
