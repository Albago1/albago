-- ============================================================================
-- Multi-day end date — DB side of the wizard "Ends on a different day" picker
-- ============================================================================
-- events.end_date already exists (see schema-reference §events). This seed:
--   1. adds event_submissions.end_date (already applied 2026-07-22)
--   2. adds end_date mapping to the four RPCs that write event rows
-- RPC bodies below were regenerated from LIVE pg_get_functiondef output on
-- 2026-07-22 (not from older seed files) with only the end_date lines added.
-- ============================================================================

alter table public.event_submissions
  add column if not exists end_date date;

-- ----------------------------------------------------------------------------
-- 1/4 admin_update_event — allow + apply the end_date patch key.
--     Clearing works: patch {"end_date": null} sets the column to NULL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_event(event_id uuid, patch jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  allowed text[] := ARRAY[
    'title','description','date','end_date','time','end_time','timezone','price',
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
    end_date               = CASE WHEN patch ? 'end_date'
                                  THEN NULLIF(patch->>'end_date', '')::date
                                  ELSE end_date END,
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
$function$;

-- ----------------------------------------------------------------------------
-- 2/4 organizer_create_event_v2 — insert end_date from the wizard input.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organizer_create_event_v2(input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid      uuid := auth.uid();
  has_org  boolean;
  new_id   uuid;
  raw_slug text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.organizers WHERE id = uid) INTO has_org;

  IF NOT has_org THEN
    RAISE EXCEPTION 'not_organizer' USING ERRCODE = '42501';
  END IF;

  raw_slug := COALESCE(NULLIF(input->>'slug', ''),
                       lower(regexp_replace(coalesce(input->>'title','event'), '[^a-z0-9]+', '-', 'g')));

  INSERT INTO public.events (
    title, slug, place_id, category, description,
    date, end_date, time, end_time, timezone,
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
    NULLIF(input->>'end_date', '')::date,
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
$function$;

-- ----------------------------------------------------------------------------
-- 3/4 organizer_update_event — full-replace semantics, end_date included.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organizer_update_event(event_id uuid, input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid     uuid := auth.uid();
  org_row public.organizers%rowtype;
  ev_row  public.events%rowtype;
  target_status text;
  gallery text[];
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into org_row from public.organizers where id = uid;
  if not found then
    raise exception 'not_organizer' using errcode = '42501';
  end if;

  select * into ev_row
    from public.events e
   where e.id = organizer_update_event.event_id
     and e.organizer_id = uid;
  if not found then
    raise exception 'not_found_or_not_owner';
  end if;

  if ev_row.status not in ('draft', 'rejected') then
    raise exception 'invalid_status';
  end if;

  target_status := case org_row.verification_tier
                     when 'verified'    then 'published'
                     when 'established' then 'published'
                     else                    'draft'
                   end;

  if input->'gallery_urls' is not null and jsonb_typeof(input->'gallery_urls') = 'array' then
    gallery := array(select jsonb_array_elements_text(input->'gallery_urls'));
  elsif input->>'banner_url' is not null and length(input->>'banner_url') > 0 then
    gallery := array[input->>'banner_url'];
  else
    gallery := '{}'::text[];
  end if;

  update public.events e set
    title                   = input->>'title',
    category                = coalesce(nullif(input->>'category', ''), 'culture'),
    description             = coalesce(input->>'description', ''),
    date                    = (input->>'date')::date,
    end_date                = nullif(input->>'end_date', '')::date,
    time                    = input->>'time',
    end_time                = input->>'end_time',
    timezone                = coalesce(nullif(input->>'timezone', ''), 'Europe/Tirane'),
    price                   = input->>'price',
    status                  = target_status,
    country                 = coalesce(nullif(input->>'country', ''), 'Albania'),
    region                  = input->>'region',
    location_slug           = coalesce(nullif(input->>'location_slug', ''), 'tirana'),
    lat                     = nullif(input->>'lat', '')::double precision,
    lng                     = nullif(input->>'lng', '')::double precision,
    address                 = input->>'address',
    address_hint            = input->>'address_hint',
    is_online               = coalesce((input->>'is_online')::boolean, false),
    online_url              = input->>'online_url',
    tags                    = case when input->'tags' is not null
                                then array(select jsonb_array_elements_text(input->'tags'))
                                else '{}'::text[]
                              end,
    language                = coalesce(nullif(input->>'language', ''), 'en'),
    gallery_urls            = gallery,
    organizer_name          = input->>'organizer_name',
    organizer_phone         = input->>'organizer_phone',
    organizer_website       = input->>'organizer_website',
    organizer_socials       = nullif(input->'organizer_socials', 'null'::jsonb),
    is_civic                = coalesce((input->>'is_civic')::boolean, false),
    event_type              = input->>'event_type',
    featured_movement_slug  = input->>'featured_movement_slug',
    organizer_contact       = input->>'organizer_contact',
    telegram_link           = input->>'telegram_link',
    whatsapp_link           = input->>'whatsapp_link',
    safety_notes            = input->>'safety_notes',
    expected_attendees      = nullif(input->>'expected_attendees', '')::integer,
    recurrence              = coalesce(nullif(input->>'recurrence', ''), 'none'),
    recurrence_until        = nullif(input->>'recurrence_until', '')::date,
    recurrence_days_of_week = case when input->'recurrence_days_of_week' is not null
                                then array(select (v.value::text)::int
                                             from jsonb_array_elements(input->'recurrence_days_of_week') v)
                                else '{}'::int[]
                              end,
    recurrence_exceptions   = case when input->'recurrence_exceptions' is not null
                                then array(select (v.value::text)::date
                                             from jsonb_array_elements(input->'recurrence_exceptions') v)
                                else '{}'::date[]
                              end,
    title_i18n              = null,
    description_i18n        = null,
    updated_at              = now()
  where e.id = organizer_update_event.event_id;

  return ev_row.id;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 4/4 submit_event_submission — capture end_date on community submissions.
--     Guarded (end_date must sort after date) so a malformed payload can't
--     store a range the events CHECK would reject at approval time.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_event_submission(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_id    uuid := auth.uid();
  caller_role  text;
  hour_count   integer;
  day_count    integer;
  new_id       uuid;
  v_title      text;
  v_date       text;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  v_title := nullif(trim(coalesce(p_payload->>'title', '')), '');
  if v_title is null then
    raise exception 'title is required';
  end if;

  v_date := nullif(trim(coalesce(p_payload->>'date', '')), '');
  if v_date is null then
    raise exception 'date is required';
  end if;

  select role into caller_role
    from public.profiles
    where id = caller_id;

  if coalesce(caller_role, '') <> 'admin' then
    select count(*) into hour_count
      from public.event_submissions
      where submitted_by_user_id = caller_id
        and created_at >= now() - interval '1 hour';

    if hour_count >= 3 then
      raise exception 'Rate limit: max 3 event submissions per hour. Try again later.';
    end if;

    select count(*) into day_count
      from public.event_submissions
      where submitted_by_user_id = caller_id
        and created_at >= now() - interval '24 hours';

    if day_count >= 10 then
      raise exception 'Rate limit: max 10 event submissions per day. Try again tomorrow.';
    end if;
  end if;

  insert into public.event_submissions (
    title, title_i18n, venue_name, place_id, date, end_date, time, end_time, timezone,
    category, price, contact_email, description, description_i18n,
    country, region, location_slug, lat, lng, address, address_hint,
    is_online, online_url, tags, language, gallery_urls, status,
    submitted_by_user_id,
    event_type, is_civic, featured_movement_slug,
    organizer_name, organizer_contact, organizer_phone, organizer_website,
    organizer_socials, telegram_link, whatsapp_link, safety_notes,
    expected_attendees,
    recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions
  )
  values (
    v_title,
    case when jsonb_typeof(p_payload->'title_i18n') = 'object'
         then p_payload->'title_i18n' else null::jsonb end,
    nullif(trim(coalesce(p_payload->>'venue_name', '')), ''),
    case when nullif(p_payload->>'place_id', '') is not null
         then (p_payload->>'place_id')::uuid
         else null end,
    v_date::date,
    case when nullif(p_payload->>'end_date', '') is not null
          and (p_payload->>'end_date') > v_date
         then (p_payload->>'end_date')::date
         else null end,
    nullif(p_payload->>'time', '')::time,
    nullif(p_payload->>'end_time', '')::time,
    nullif(p_payload->>'timezone', ''),
    coalesce(nullif(p_payload->>'category', ''), 'culture'),
    nullif(p_payload->>'price', ''),
    nullif(p_payload->>'contact_email', ''),
    coalesce(p_payload->>'description', ''),
    case when jsonb_typeof(p_payload->'description_i18n') = 'object'
         then p_payload->'description_i18n' else null::jsonb end,
    coalesce(nullif(p_payload->>'country', ''), 'Unknown'),
    nullif(p_payload->>'region', ''),
    coalesce(nullif(p_payload->>'location_slug', ''), 'unknown'),
    case when (p_payload->>'lat') ~ '^-?[0-9]+\.?[0-9]*$'
         then (p_payload->>'lat')::numeric
         else null end,
    case when (p_payload->>'lng') ~ '^-?[0-9]+\.?[0-9]*$'
         then (p_payload->>'lng')::numeric
         else null end,
    nullif(p_payload->>'address', ''),
    nullif(p_payload->>'address_hint', ''),
    coalesce((p_payload->>'is_online')::boolean, false),
    nullif(p_payload->>'online_url', ''),
    case when jsonb_typeof(p_payload->'tags') = 'array'
         then array(select jsonb_array_elements_text(p_payload->'tags'))::text[]
         else '{}'::text[] end,
    coalesce(nullif(p_payload->>'language', ''), 'en'),
    case when jsonb_typeof(p_payload->'gallery_urls') = 'array'
         then array(select jsonb_array_elements_text(p_payload->'gallery_urls'))::text[]
         else '{}'::text[] end,
    'pending',
    caller_id,
    nullif(p_payload->>'event_type', ''),
    coalesce((p_payload->>'is_civic')::boolean, false),
    nullif(p_payload->>'featured_movement_slug', ''),
    nullif(p_payload->>'organizer_name', ''),
    nullif(p_payload->>'organizer_contact', ''),
    nullif(p_payload->>'organizer_phone', ''),
    nullif(p_payload->>'organizer_website', ''),
    case when jsonb_typeof(p_payload->'organizer_socials') = 'object'
         then p_payload->'organizer_socials'
         else null::jsonb end,
    nullif(p_payload->>'telegram_link', ''),
    nullif(p_payload->>'whatsapp_link', ''),
    nullif(p_payload->>'safety_notes', ''),
    case when (p_payload->>'expected_attendees') ~ '^[0-9]+$'
         then (p_payload->>'expected_attendees')::integer
         else null end,
    coalesce(nullif(p_payload->>'recurrence', ''), 'none'),
    nullif(p_payload->>'recurrence_until', '')::date,
    case when jsonb_typeof(p_payload->'recurrence_days_of_week') = 'array'
         then array(select (jsonb_array_elements_text(p_payload->'recurrence_days_of_week'))::integer)::integer[]
         else '{}'::integer[] end,
    case when jsonb_typeof(p_payload->'recurrence_exceptions') = 'array'
         then array(select jsonb_array_elements_text(p_payload->'recurrence_exceptions')::date)
         else '{}'::date[] end
  )
  returning id into new_id;

  return new_id;
end;
$function$;
