-- Phase 13 — rich event data model.
-- Adds end_time, timezone, tags, language, address, is_online, online_url,
-- and organizer contact fields (name, phone, website, socials) to both the
-- events and event_submissions tables.
--
-- Recreates admin_update_event with the expanded whitelist so the admin
-- edit form can patch any new column.
--
-- Adds organizer_create_event_v2 — a forward-compatible variant that takes
-- the same JSONB shape but accepts all the new fields. The original
-- organizer_create_event(input jsonb) is left untouched so the existing
-- minimal /organizer/create form keeps working until it migrates to v2.
--
-- Idempotent: safe to re-run.

-- 1) events table columns ---------------------------------------------------

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time          text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS timezone          text DEFAULT 'Europe/Tirane';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tags              text[] DEFAULT '{}';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS language          text DEFAULT 'en';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS address           text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_online         boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS online_url        text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer_name    text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer_phone   text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer_website text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer_socials jsonb;

-- 2) event_submissions columns ----------------------------------------------

ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS end_time          text;
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS timezone          text DEFAULT 'Europe/Tirane';
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS tags              text[] DEFAULT '{}';
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS language          text DEFAULT 'en';
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS address           text;
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS is_online         boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS online_url        text;
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS organizer_name    text;
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS organizer_phone   text;
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS organizer_website text;
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS organizer_socials jsonb;
ALTER TABLE public.event_submissions ADD COLUMN IF NOT EXISTS banner_url        text;

-- 3) indexes ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS events_tags_gin
  ON public.events USING GIN (tags);

CREATE INDEX IF NOT EXISTS events_is_online_idx
  ON public.events (is_online)
  WHERE is_online = true;

-- 4) recreate admin_update_event with expanded whitelist --------------------

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
    'title',
    'description',
    'date',
    'time',
    'end_time',
    'timezone',
    'price',
    'category',
    'highlight',
    'status',
    'location_slug',
    'country',
    'region',
    'lat',
    'lng',
    'address',
    'banner_url',
    'admin_note',
    'event_type',
    'is_civic',
    'is_online',
    'online_url',
    'tags',
    'language',
    'featured_movement_slug',
    'organizer_contact',
    'organizer_name',
    'organizer_phone',
    'organizer_website',
    'organizer_socials',
    'telegram_link',
    'whatsapp_link',
    'safety_notes',
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
    time                   = COALESCE(patch->>'time', time),
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

-- 5) organizer_create_event_v2 ----------------------------------------------

-- Forward-compatible variant of organizer_create_event(input jsonb). Same
-- semantics — creates an events row owned by auth.uid() with status 'draft'
-- and origin 'organizer_dashboard' — but accepts the rich data model.
--
-- The caller is expected to have an organizers row already (organizer
-- onboarding complete). The function does NOT verify this; it relies on the
-- events_insert_organizer policy if the function ends up SECURITY INVOKER.
-- We keep SECURITY DEFINER here so we can do the onboarding check ourselves
-- and return a friendly error code.

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
    safety_notes, expected_attendees
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
    NULLIF(input->>'expected_attendees', '')::integer
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.organizer_create_event_v2(jsonb) TO authenticated;

-- Verify
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_update_event', 'organizer_create_event_v2')
ORDER BY p.proname;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'events'
  AND column_name IN (
    'end_time','timezone','tags','language','address','is_online',
    'online_url','organizer_name','organizer_phone','organizer_website',
    'organizer_socials'
  )
ORDER BY column_name;
