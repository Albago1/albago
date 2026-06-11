-- Phase 15 — recurring events.
--
-- Lets a single event row carry a recurrence rule instead of duplicating the
-- row per occurrence. Designed for civic events that run daily/weekly (e.g.
-- the Tirana protests) without flooding /events or /protests.
--
-- Four new columns on events + event_submissions:
--   recurrence              text   — 'none' | 'daily' | 'weekly'. Default 'none'.
--   recurrence_until        date   — last date the series runs (NULL = open-ended).
--   recurrence_days_of_week int[]  — ISO 1=Mon..7=Sun. Used when recurrence='weekly'.
--   recurrence_exceptions   date[] — dates to skip within the series.
--
-- The CHECK constraint enforces the recurrence enum. A GIN index on
-- recurrence_days_of_week is added because future "events on Wednesdays"
-- filters will benefit; the others are cheap scalar columns.
--
-- Both admin_update_event (whitelist) and organizer_create_event_v2 (INSERT)
-- learn about the four new columns. Idempotent; safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) events columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence              text   NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_until        date,
  ADD COLUMN IF NOT EXISTS recurrence_days_of_week integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence_exceptions   date[]    DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_recurrence_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_recurrence_check
      CHECK (recurrence IN ('none', 'daily', 'weekly'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) event_submissions columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_submissions
  ADD COLUMN IF NOT EXISTS recurrence              text   NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_until        date,
  ADD COLUMN IF NOT EXISTS recurrence_days_of_week integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence_exceptions   date[]    DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_submissions_recurrence_check'
  ) THEN
    ALTER TABLE public.event_submissions
      ADD CONSTRAINT event_submissions_recurrence_check
      CHECK (recurrence IN ('none', 'daily', 'weekly'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Index for day-of-week filtering
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS events_recurrence_dow_gin
  ON public.events USING GIN (recurrence_days_of_week);

-- ---------------------------------------------------------------------------
-- 4) admin_update_event — add the 4 recurrence keys to the whitelist
-- ---------------------------------------------------------------------------
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
    'recurrence_exceptions'
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

-- ---------------------------------------------------------------------------
-- 5) organizer_create_event_v2 — accept recurrence fields on INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organizer_create_event_v2(input jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  uid      uuid := auth.uid();
  has_org  boolean;
  new_id   uuid;
  raw_slug text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organizers WHERE id = uid
  ) INTO has_org;

  IF NOT has_org THEN
    RAISE EXCEPTION 'not_organizer' USING ERRCODE = '42501';
  END IF;

  raw_slug := COALESCE(NULLIF(input->>'slug', ''),
                       lower(regexp_replace(coalesce(input->>'title','event'), '[^a-z0-9]+', '-', 'g')));

  INSERT INTO public.events (
    title, slug, place_id, category, description,
    date, time, end_time, timezone,
    price, status, country, region, location_slug,
    lat, lng, address,
    is_online, online_url,
    tags, language,
    organizer_id, origin, banner_url,
    organizer_name, organizer_phone, organizer_website, organizer_socials,
    is_civic, event_type, featured_movement_slug,
    organizer_contact, telegram_link, whatsapp_link,
    safety_notes, expected_attendees,
    recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions
  ) VALUES (
    input->>'title',
    raw_slug || '-' || substring(replace(gen_random_uuid()::text, '-', '') for 8),
    NULLIF(input->>'place_id', '')::uuid,
    COALESCE(NULLIF(input->>'category', ''), 'culture'),
    COALESCE(input->>'description', ''),
    (input->>'date')::date,
    input->>'time',
    input->>'end_time',
    COALESCE(NULLIF(input->>'timezone', ''), 'Europe/Tirane'),
    input->>'price',
    'draft',
    COALESCE(NULLIF(input->>'country', ''), 'Albania'),
    input->>'region',
    COALESCE(NULLIF(input->>'location_slug', ''), 'tirana'),
    NULLIF(input->>'lat', '')::double precision,
    NULLIF(input->>'lng', '')::double precision,
    input->>'address',
    COALESCE((input->>'is_online')::boolean, false),
    input->>'online_url',
    CASE WHEN input->'tags' IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(input->'tags'))
      ELSE '{}'::text[]
    END,
    COALESCE(NULLIF(input->>'language', ''), 'en'),
    uid,
    'organizer_dashboard',
    input->>'banner_url',
    input->>'organizer_name',
    input->>'organizer_phone',
    input->>'organizer_website',
    NULLIF(input->'organizer_socials', 'null'::jsonb),
    COALESCE((input->>'is_civic')::boolean, false),
    input->>'event_type',
    input->>'featured_movement_slug',
    input->>'organizer_contact',
    input->>'telegram_link',
    input->>'whatsapp_link',
    input->>'safety_notes',
    NULLIF(input->>'expected_attendees', '')::integer,
    COALESCE(NULLIF(input->>'recurrence', ''), 'none'),
    NULLIF(input->>'recurrence_until', '')::date,
    CASE WHEN input->'recurrence_days_of_week' IS NOT NULL
      THEN ARRAY(SELECT (jsonb_array_elements_text(input->'recurrence_days_of_week'))::integer)
      ELSE '{}'::integer[]
    END,
    CASE WHEN input->'recurrence_exceptions' IS NOT NULL
      THEN ARRAY(SELECT (jsonb_array_elements_text(input->'recurrence_exceptions'))::date)
      ELSE '{}'::date[]
    END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.organizer_create_event_v2(jsonb) TO authenticated;
