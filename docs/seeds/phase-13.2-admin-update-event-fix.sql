-- =============================================================================
-- Phase 13.2 — Fix admin_update_event COALESCE on `time`
-- =============================================================================
-- The `events.time` column is `time without time zone`, but the previous
-- admin_update_event RPC was COALESCEing it against `patch->>'time'` (text)
-- without a cast. Postgres rejects this at execute time with:
--
--   "COALESCE types text and time without time zone cannot be matched"
--
-- The error fires on EVERY admin update call — including publish/unpublish/
-- archive — because every column gets COALESCE'd whether or not it's in
-- the patch. (When the key is absent, the text expression evaluates to a
-- text-typed NULL, which still trips the type-match check.)
--
-- Fix: cast `patch->>'time'` to `::time without time zone` and guard against
-- empty-string inputs with NULLIF so blank values become SQL NULL instead of
-- crashing the cast.
--
-- Recreates the whole function. Idempotent — safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_event(
  event_id uuid,
  patch    jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  allowed text[] := ARRAY[
    'title','description','date','time','end_time','timezone','price',
    'category','highlight','status','location_slug','country','region',
    'lat','lng','address','banner_url','admin_note','event_type','is_civic',
    'is_online','online_url','tags','language','featured_movement_slug',
    'organizer_contact','organizer_name','organizer_phone','organizer_website',
    'organizer_socials','telegram_link','whatsapp_link','safety_notes',
    'expected_attendees'
  ];
  patch_key text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  FOR patch_key IN SELECT jsonb_object_keys(patch)
  LOOP
    IF NOT (patch_key = ANY(allowed)) THEN
      RAISE EXCEPTION 'forbidden_column: %', patch_key USING ERRCODE = '42501';
    END IF;
  END LOOP;

  UPDATE public.events SET
    title                  = COALESCE(patch->>'title', title),
    description            = COALESCE(patch->>'description', description),
    date                   = COALESCE((patch->>'date')::date, date),
    time                   = COALESCE(NULLIF(patch->>'time', '')::time without time zone, time),
    end_time               = COALESCE(patch->>'end_time', end_time),
    timezone               = COALESCE(patch->>'timezone', timezone),
    price                  = COALESCE(patch->>'price', price),
    category               = COALESCE(patch->>'category', category),
    highlight              = COALESCE((patch->>'highlight')::boolean, highlight),
    status                 = COALESCE(patch->>'status', status),
    location_slug          = COALESCE(patch->>'location_slug', location_slug),
    country                = COALESCE(patch->>'country', country),
    region                 = COALESCE(patch->>'region', region),
    lat                    = COALESCE((patch->>'lat')::double precision, lat),
    lng                    = COALESCE((patch->>'lng')::double precision, lng),
    address                = COALESCE(patch->>'address', address),
    banner_url             = COALESCE(patch->>'banner_url', banner_url),
    admin_note             = COALESCE(patch->>'admin_note', admin_note),
    event_type             = COALESCE(patch->>'event_type', event_type),
    is_civic               = COALESCE((patch->>'is_civic')::boolean, is_civic),
    is_online              = COALESCE((patch->>'is_online')::boolean, is_online),
    online_url             = COALESCE(patch->>'online_url', online_url),
    tags                   = COALESCE(
                               CASE WHEN patch->'tags' IS NOT NULL
                                 THEN ARRAY(SELECT jsonb_array_elements_text(patch->'tags'))
                                 ELSE NULL END,
                               tags
                             ),
    language               = COALESCE(patch->>'language', language),
    featured_movement_slug = COALESCE(patch->>'featured_movement_slug', featured_movement_slug),
    organizer_contact      = COALESCE(patch->>'organizer_contact', organizer_contact),
    organizer_name         = COALESCE(patch->>'organizer_name', organizer_name),
    organizer_phone        = COALESCE(patch->>'organizer_phone', organizer_phone),
    organizer_website      = COALESCE(patch->>'organizer_website', organizer_website),
    organizer_socials      = COALESCE(patch->'organizer_socials', organizer_socials),
    telegram_link          = COALESCE(patch->>'telegram_link', telegram_link),
    whatsapp_link          = COALESCE(patch->>'whatsapp_link', whatsapp_link),
    safety_notes           = COALESCE(patch->>'safety_notes', safety_notes),
    expected_attendees     = COALESCE((patch->>'expected_attendees')::integer, expected_attendees),
    updated_at             = now()
  WHERE id = event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN event_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_update_event(uuid, jsonb) TO authenticated;
