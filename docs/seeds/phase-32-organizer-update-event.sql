-- Phase 32: organizer_update_event — real edit support for organizer drafts
--
-- Until now the organizer dashboard's "Edit" button linked to
-- /organizer/create?draft=<id> but nothing consumed the param: the wizard
-- opened with an unrelated localStorage draft and submitting created a NEW
-- event via organizer_create_event_v2. This RPC gives organizers a proper
-- update path for their own events while they are still editable
-- (status 'draft' or 'rejected').
--
-- Semantics mirror the LIVE organizer_create_event_v2 (verified 2026-07-18
-- via PostgREST probes — note the deployed admin_update_event takes
-- (event_id, patch), not the (p_id, patch) written in phase-18's seed):
--   * caller must be an onboarded organizer and own the row
--   * only 'draft' / 'rejected' rows are editable — published / in-review
--     events raise invalid_status
--   * resulting status repeats the create-tier logic: verified/established
--     publish immediately, everyone else returns to 'draft' (the client then
--     auto-submits unverified drafts for review, same as the create flow)
--   * full-replace field mapping identical to organizer_create_event_v2
--   * manual edits invalidate the LENS-3 translation packs (same rule as
--     the admin editor) so stale translations can't shadow the new text
--   * slug, organizer_id, origin, created_at are never touched

create or replace function public.organizer_update_event(event_id uuid, input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
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

  -- gallery_urls: accept array or fall back to a single banner_url
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
$func$;

grant execute on function public.organizer_update_event(uuid, jsonb) to authenticated;
