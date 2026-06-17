-- Phase 19 — admin_repost_event RPC.
-- Lets an admin clone an existing event into a brand-new draft row with a
-- fresh schedule (date / time / end_time). Everything else — title,
-- description, address, photos, organizer block, recurrence settings, civic
-- flags, organizer_id — is carried across from the source row. The original
-- event row is left untouched.
--
-- Ownership: the new row preserves the source row's organizer_id, so the
-- repost shows up in the original organizer's dashboard. Admin's auth.uid()
-- is recorded as origin='organizer_dashboard' for audit consistency with
-- regular organizer-created events; the audit trail is the admin_note field
-- and updated_at, plus the existing platform logs.
--
-- Slug: a fresh slug is generated as `{source-slug-base}-{new-date}`. On
-- collision (same organizer reposts to the same day twice), a numeric suffix
-- `-2`, `-3`, ... is appended.
--
-- Status: new row starts as 'draft'. Admin can flip it to 'published' via
-- the existing /admin/events Publish action.
--
-- SECURITY DEFINER. Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.admin_repost_event(
  source_event_id uuid,
  new_date        date,
  new_time        text DEFAULT NULL,
  new_end_time    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src        public.events%ROWTYPE;
  new_id     uuid := gen_random_uuid();
  base_slug  text;
  candidate  text;
  suffix     int := 1;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO src FROM public.events WHERE id = source_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Build a fresh slug: strip any trailing -YYYY-MM-DD or -N suffix from the
  -- source slug to get a clean base, then append the new date. Collide → -2.
  base_slug := regexp_replace(src.slug, '-\d{4}-\d{2}-\d{2}(-\d+)?$', '');
  base_slug := regexp_replace(base_slug, '-\d+$', '');
  candidate := base_slug || '-' || to_char(new_date, 'YYYY-MM-DD');

  WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_slug || '-' || to_char(new_date, 'YYYY-MM-DD') || '-' || suffix;
  END LOOP;

  INSERT INTO public.events (
    id,
    slug,
    title,
    description,
    category,
    date,
    time,
    end_time,
    timezone,
    price,
    highlight,
    status,
    location_slug,
    country,
    region,
    place_id,
    lat,
    lng,
    address,
    is_online,
    online_url,
    tags,
    language,
    banner_url,
    gallery_urls,
    organizer_id,
    origin,
    organizer_name,
    organizer_contact,
    organizer_phone,
    organizer_website,
    organizer_socials,
    is_civic,
    event_type,
    featured_movement_slug,
    telegram_link,
    whatsapp_link,
    safety_notes,
    expected_attendees,
    recurrence,
    recurrence_until,
    recurrence_days_of_week,
    recurrence_exceptions,
    admin_note,
    created_at,
    updated_at
  ) VALUES (
    new_id,
    candidate,
    src.title,
    src.description,
    src.category,
    new_date,
    new_time::time,
    new_end_time::time,
    src.timezone,
    src.price,
    false,                                 -- new draft never starts highlighted
    'draft',
    src.location_slug,
    src.country,
    src.region,
    src.place_id,
    src.lat,
    src.lng,
    src.address,
    src.is_online,
    src.online_url,
    src.tags,
    src.language,
    src.banner_url,
    src.gallery_urls,
    src.organizer_id,                       -- preserve original organizer
    'organizer_dashboard',
    src.organizer_name,
    src.organizer_contact,
    src.organizer_phone,
    src.organizer_website,
    src.organizer_socials,
    src.is_civic,
    src.event_type,
    src.featured_movement_slug,
    src.telegram_link,
    src.whatsapp_link,
    src.safety_notes,
    src.expected_attendees,
    src.recurrence,
    src.recurrence_until,
    src.recurrence_days_of_week,
    src.recurrence_exceptions,
    'Reposted from ' || src.slug || ' by admin on ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
    now(),
    now()
  );

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_repost_event(uuid, date, text, text) TO authenticated;

-- Verify
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'admin_repost_event';
