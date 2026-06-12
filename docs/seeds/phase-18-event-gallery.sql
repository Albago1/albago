-- Phase 18: Multi-image event galleries
--
-- Adds gallery_urls text[] to events and event_submissions so an event can
-- carry up to 5 photos (capped in the application layer, not in SQL — the
-- column itself is unbounded). The legacy banner_url column stays as the
-- canonical "first photo" and is kept in lockstep via a trigger: whatever
-- ends up at gallery_urls[1] also lives at banner_url, so every existing
-- read path keeps working without code changes.
--
-- The organizer_create_event_v2 and admin_update_event RPCs are re-redefined
-- here (last touched in phases 17 and 15 respectively) to accept a
-- gallery_urls JSON array on the input patch.

-- =============================================================================
-- 1. Schema additions
-- =============================================================================

alter table public.events
  add column if not exists gallery_urls text[] not null default '{}';

alter table public.event_submissions
  add column if not exists gallery_urls text[] not null default '{}';

-- One-time backfill: any row that has a banner_url but an empty array should
-- start life with [banner_url] as its single-image gallery. Idempotent —
-- re-running the migration is a no-op once the array is populated.
update public.events
   set gallery_urls = array[banner_url]
 where banner_url is not null
   and coalesce(array_length(gallery_urls, 1), 0) = 0;

update public.event_submissions
   set gallery_urls = array[banner_url]
 where banner_url is not null
   and coalesce(array_length(gallery_urls, 1), 0) = 0;

-- =============================================================================
-- 2. Keep banner_url and gallery_urls[1] in lockstep
-- =============================================================================

create or replace function public._sync_event_banner_from_gallery()
returns trigger
language plpgsql
as $$
begin
  if new.gallery_urls is not null and coalesce(array_length(new.gallery_urls, 1), 0) > 0 then
    new.banner_url := new.gallery_urls[1];
  end if;
  return new;
end;
$$;

drop trigger if exists events_sync_banner_from_gallery on public.events;
create trigger events_sync_banner_from_gallery
  before insert or update of gallery_urls on public.events
  for each row execute function public._sync_event_banner_from_gallery();

drop trigger if exists event_submissions_sync_banner_from_gallery on public.event_submissions;
create trigger event_submissions_sync_banner_from_gallery
  before insert or update of gallery_urls on public.event_submissions
  for each row execute function public._sync_event_banner_from_gallery();

-- =============================================================================
-- 3. organizer_create_event_v2 — same body as phase 17 plus gallery_urls
-- =============================================================================

create or replace function public.organizer_create_event_v2(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
declare
  uid                uuid := auth.uid();
  org_row            public.organizers%rowtype;
  new_id             uuid;
  raw_slug           text;
  target_status      text;
  recent_count       integer;
  gallery            text[];
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into org_row from public.organizers where id = uid;
  if not found then
    raise exception 'not_organizer' using errcode = '42501';
  end if;

  -- Weekly rate limit (every tier, including verified)
  select count(*) into recent_count
    from public.events
   where organizer_id = uid
     and created_at >= now() - interval '7 days';

  if recent_count >= coalesce(org_row.weekly_event_quota, 10) then
    raise exception 'rate_limit_exceeded' using errcode = '53400';
  end if;

  target_status := case org_row.verification_tier
                     when 'verified'    then 'published'
                     when 'established' then 'published'
                     else                    'draft'
                   end;

  raw_slug := coalesce(
    nullif(input->>'slug', ''),
    lower(regexp_replace(coalesce(input->>'title','event'), '[^a-z0-9]+', '-', 'g'))
  );

  -- gallery_urls: accept array or fall back to a single banner_url
  if input->'gallery_urls' is not null and jsonb_typeof(input->'gallery_urls') = 'array' then
    gallery := array(select jsonb_array_elements_text(input->'gallery_urls'));
  elsif input->>'banner_url' is not null and length(input->>'banner_url') > 0 then
    gallery := array[input->>'banner_url'];
  else
    gallery := '{}'::text[];
  end if;

  insert into public.events (
    title, slug, place_id, category, description,
    date, time, end_time, timezone,
    price, status, country, region, location_slug,
    lat, lng, address,
    is_online, online_url,
    tags, language,
    organizer_id, origin,
    gallery_urls,
    organizer_name, organizer_phone, organizer_website, organizer_socials,
    is_civic, event_type, featured_movement_slug,
    organizer_contact, telegram_link, whatsapp_link,
    safety_notes, expected_attendees
  ) values (
    input->>'title',
    raw_slug || '-' || substring(replace(gen_random_uuid()::text, '-', '') for 8),
    nullif(input->>'place_id', '')::uuid,
    coalesce(nullif(input->>'category', ''), 'culture'),
    coalesce(input->>'description', ''),
    (input->>'date')::date,
    input->>'time',
    input->>'end_time',
    coalesce(nullif(input->>'timezone', ''), 'Europe/Tirane'),
    input->>'price',
    target_status,
    coalesce(nullif(input->>'country', ''), 'Albania'),
    input->>'region',
    coalesce(nullif(input->>'location_slug', ''), 'tirana'),
    nullif(input->>'lat', '')::double precision,
    nullif(input->>'lng', '')::double precision,
    input->>'address',
    coalesce((input->>'is_online')::boolean, false),
    input->>'online_url',
    case when input->'tags' is not null
      then array(select jsonb_array_elements_text(input->'tags'))
      else '{}'::text[]
    end,
    coalesce(nullif(input->>'language', ''), 'en'),
    uid,
    'organizer_dashboard',
    gallery,
    input->>'organizer_name',
    input->>'organizer_phone',
    input->>'organizer_website',
    nullif(input->'organizer_socials', 'null'::jsonb),
    coalesce((input->>'is_civic')::boolean, false),
    input->>'event_type',
    input->>'featured_movement_slug',
    input->>'organizer_contact',
    input->>'telegram_link',
    input->>'whatsapp_link',
    input->>'safety_notes',
    nullif(input->>'expected_attendees', '')::integer
  ) returning id into new_id;

  return new_id;
end;
$func$;

grant execute on function public.organizer_create_event_v2(jsonb) to authenticated;

-- =============================================================================
-- 4. admin_update_event — same body as phase 15 plus gallery_urls
-- =============================================================================

create or replace function public.admin_update_event(p_id uuid, patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  allowed_keys text[] := array[
    'title','slug','description','category','date','time','end_time','timezone',
    'price','highlight','status','country','region','location_slug',
    'lat','lng','address','banner_url','gallery_urls','admin_note','event_type','is_civic',
    'featured_movement_slug','organizer_name','organizer_phone','organizer_website',
    'organizer_socials','organizer_contact','telegram_link','whatsapp_link',
    'safety_notes','expected_attendees','is_online','online_url','tags','language',
    'recurrence','recurrence_until','recurrence_days_of_week','recurrence_exceptions'
  ];
  k text;
  gallery_patch text[];
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  for k in select jsonb_object_keys(patch)
  loop
    if not (k = any(allowed_keys)) then
      raise exception 'invalid_field: %', k using errcode = '22023';
    end if;
  end loop;

  if patch ? 'gallery_urls' and jsonb_typeof(patch->'gallery_urls') = 'array' then
    gallery_patch := array(select jsonb_array_elements_text(patch->'gallery_urls'));
  end if;

  update public.events set
    title                  = coalesce(patch->>'title', title),
    slug                   = coalesce(patch->>'slug', slug),
    description            = coalesce(patch->>'description', description),
    category               = coalesce(patch->>'category', category),
    date                   = coalesce((patch->>'date')::date, date),
    time                   = case when patch ? 'time'     then patch->>'time'     else time end,
    end_time               = case when patch ? 'end_time' then patch->>'end_time' else end_time end,
    timezone               = coalesce(patch->>'timezone', timezone),
    price                  = case when patch ? 'price' then patch->>'price' else price end,
    highlight              = coalesce((patch->>'highlight')::boolean, highlight),
    status                 = coalesce(patch->>'status', status),
    country                = coalesce(patch->>'country', country),
    region                 = coalesce(patch->>'region', region),
    location_slug          = coalesce(patch->>'location_slug', location_slug),
    lat                    = case when patch ? 'lat' then nullif(patch->>'lat','')::double precision else lat end,
    lng                    = case when patch ? 'lng' then nullif(patch->>'lng','')::double precision else lng end,
    address                = case when patch ? 'address' then patch->>'address' else address end,
    banner_url             = coalesce(patch->>'banner_url', banner_url),
    gallery_urls           = coalesce(gallery_patch, gallery_urls),
    admin_note             = case when patch ? 'admin_note' then patch->>'admin_note' else admin_note end,
    event_type             = case when patch ? 'event_type' then patch->>'event_type' else event_type end,
    is_civic               = coalesce((patch->>'is_civic')::boolean, is_civic),
    featured_movement_slug = case when patch ? 'featured_movement_slug' then patch->>'featured_movement_slug' else featured_movement_slug end,
    organizer_name         = case when patch ? 'organizer_name' then patch->>'organizer_name' else organizer_name end,
    organizer_phone        = case when patch ? 'organizer_phone' then patch->>'organizer_phone' else organizer_phone end,
    organizer_website      = case when patch ? 'organizer_website' then patch->>'organizer_website' else organizer_website end,
    organizer_socials      = case when patch ? 'organizer_socials' then nullif(patch->'organizer_socials', 'null'::jsonb) else organizer_socials end,
    organizer_contact      = case when patch ? 'organizer_contact' then patch->>'organizer_contact' else organizer_contact end,
    telegram_link          = case when patch ? 'telegram_link' then patch->>'telegram_link' else telegram_link end,
    whatsapp_link          = case when patch ? 'whatsapp_link' then patch->>'whatsapp_link' else whatsapp_link end,
    safety_notes           = case when patch ? 'safety_notes' then patch->>'safety_notes' else safety_notes end,
    expected_attendees     = case when patch ? 'expected_attendees' then nullif(patch->>'expected_attendees','')::integer else expected_attendees end,
    is_online              = coalesce((patch->>'is_online')::boolean, is_online),
    online_url             = case when patch ? 'online_url' then patch->>'online_url' else online_url end,
    tags                   = case when patch ? 'tags'
                                 then array(select jsonb_array_elements_text(patch->'tags'))
                                 else tags end,
    language               = coalesce(patch->>'language', language),
    recurrence             = case when patch ? 'recurrence' then patch->>'recurrence' else recurrence end,
    recurrence_until       = case when patch ? 'recurrence_until' then nullif(patch->>'recurrence_until','')::date else recurrence_until end,
    recurrence_days_of_week = case when patch ? 'recurrence_days_of_week'
                                    then array(select (v.value::text)::int from jsonb_array_elements(patch->'recurrence_days_of_week') v)
                                    else recurrence_days_of_week end,
    recurrence_exceptions   = case when patch ? 'recurrence_exceptions'
                                    then array(select (v.value::text)::date from jsonb_array_elements(patch->'recurrence_exceptions') v)
                                    else recurrence_exceptions end,
    updated_at             = now()
  where id = p_id;
end;
$func$;

grant execute on function public.admin_update_event(uuid, jsonb) to authenticated;
