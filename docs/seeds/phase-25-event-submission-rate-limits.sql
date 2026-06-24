-- =============================================================================
-- Phase 25 — Event submission rate limits
-- =============================================================================
-- Mirrors Phase 24 (placards). A SECURITY DEFINER RPC `submit_event_submission`
-- enforces a per-user rate limit (3 submissions / hour, 10 / day) before
-- inserting into event_submissions. The existing `submissions_insert` policy
-- is dropped — authenticated users now reach event_submissions only through
-- the RPC. Anonymous users were never able to insert (policy required auth).
-- Admins are exempt from the rate limit.
--
-- Idempotent — safe to re-run.
-- =============================================================================

----------------------------------------------------------------------------
-- 1. Rate-limited submission RPC
----------------------------------------------------------------------------

create or replace function public.submit_event_submission(
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  -- Admins skip the rate limit (backfills, operational fixes).
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
    title, venue_name, place_id, date, time, end_time, timezone,
    category, price, contact_email, description,
    country, region, location_slug, lat, lng, address,
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
    nullif(trim(coalesce(p_payload->>'venue_name', '')), ''),
    case when nullif(p_payload->>'place_id', '') is not null
         then (p_payload->>'place_id')::uuid
         else null end,
    v_date::date,
    nullif(p_payload->>'time', '')::time,
    nullif(p_payload->>'end_time', '')::time,
    nullif(p_payload->>'timezone', ''),
    coalesce(nullif(p_payload->>'category', ''), 'culture'),
    nullif(p_payload->>'price', ''),
    nullif(p_payload->>'contact_email', ''),
    coalesce(p_payload->>'description', ''),
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
$$;

grant execute on function public.submit_event_submission(jsonb) to authenticated;

----------------------------------------------------------------------------
-- 2. Lock down direct INSERT — RPC is the only path for regular users
----------------------------------------------------------------------------
-- The Phase 2 `submissions_insert` policy is dropped; no replacement INSERT
-- policy is created for the `authenticated` role. The SECURITY DEFINER RPC
-- is the only writable path, which means every submission passes through
-- the rate limit. Admins keep their existing UPDATE policy unchanged.

drop policy if exists "submissions_insert" on public.event_submissions;
