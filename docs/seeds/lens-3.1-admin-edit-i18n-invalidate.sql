-- =============================================================================
-- LENS-3.1 — let admin_update_event accept title_i18n / description_i18n
-- =============================================================================
-- Why: the admin edit page now sends `title_i18n: null` whenever the title is
-- edited (and likewise for description). The LENS-3 translation packs hold
-- translations of the ORIGINAL scanned text; display prefers the pack over the
-- base column, so a stale pack keeps showing the old wording after an edit.
-- The previous RPC whitelist rejected these keys.
--
-- Body is identical to the deployed phase-15 version (event_id / RETURNS uuid
-- — the phase-18 p_id/void rewrite was never applied) plus the two i18n
-- columns. Signature must not change: CREATE OR REPLACE can't alter the return
-- type or parameter names, and the client calls it with { event_id, patch }.
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
    'featured_movement_slug','organizer_contact','organizer_name',
    'organizer_phone','organizer_website','organizer_socials',
    'telegram_link','whatsapp_link','safety_notes','expected_attendees',
    'is_online','online_url','tags','language',
    'recurrence','recurrence_until','recurrence_days_of_week',
    'recurrence_exceptions',
    'title_i18n','description_i18n'
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
    title_i18n             = CASE WHEN patch ? 'title_i18n'
                                  THEN NULLIF(patch->'title_i18n', 'null'::jsonb)
                                  ELSE title_i18n END,
    description            = COALESCE(patch->>'description', description),
    description_i18n       = CASE WHEN patch ? 'description_i18n'
                                  THEN NULLIF(patch->'description_i18n', 'null'::jsonb)
                                  ELSE description_i18n END,
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
    featured_movement_slug = COALESCE(patch->>'featured_movement_slug', featured_movement_slug),
    organizer_contact      = COALESCE(patch->>'organizer_contact', organizer_contact),
    organizer_name         = COALESCE(patch->>'organizer_name', organizer_name),
    organizer_phone        = COALESCE(patch->>'organizer_phone', organizer_phone),
    organizer_website      = COALESCE(patch->>'organizer_website', organizer_website),
    organizer_socials      = CASE WHEN patch ? 'organizer_socials'
                                  THEN NULLIF(patch->'organizer_socials', 'null'::jsonb)
                                  ELSE organizer_socials END,
    telegram_link          = COALESCE(patch->>'telegram_link', telegram_link),
    whatsapp_link          = COALESCE(patch->>'whatsapp_link', whatsapp_link),
    safety_notes           = COALESCE(patch->>'safety_notes', safety_notes),
    expected_attendees     = COALESCE(NULLIF(patch->>'expected_attendees', '')::integer, expected_attendees),
    is_online              = COALESCE((patch->>'is_online')::boolean, is_online),
    online_url             = COALESCE(patch->>'online_url', online_url),
    tags                   = CASE WHEN patch ? 'tags'
                                  THEN ARRAY(SELECT jsonb_array_elements_text(patch->'tags'))
                                  ELSE tags END,
    language               = COALESCE(patch->>'language', language),
    recurrence             = COALESCE(patch->>'recurrence', recurrence),
    recurrence_until       = CASE WHEN patch ? 'recurrence_until'
                                  THEN NULLIF(patch->>'recurrence_until', '')::date
                                  ELSE recurrence_until END,
    recurrence_days_of_week = CASE WHEN patch ? 'recurrence_days_of_week'
                                   THEN ARRAY(SELECT (jsonb_array_elements_text(patch->'recurrence_days_of_week'))::integer)
                                   ELSE recurrence_days_of_week END,
    recurrence_exceptions  = CASE WHEN patch ? 'recurrence_exceptions'
                                  THEN ARRAY(SELECT (jsonb_array_elements_text(patch->'recurrence_exceptions'))::date)
                                  ELSE recurrence_exceptions END,
    updated_at             = now()
  WHERE id = event_id;

  RETURN event_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_update_event(uuid, jsonb) TO authenticated;
