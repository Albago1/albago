-- =============================================================================
-- Phase 36 — Edit = the create wizard, for published events too
-- =============================================================================
-- Two changes so "Edit" on any event opens the same creation wizard, pre-filled,
-- and saving republishes instantly:
--
--   1. organizer_update_event now also accepts a *published* event (was
--      draft/rejected only). Verified/established organizers republish
--      instantly; unverified ones drop to 'draft' and the client re-submits for
--      review — exactly the create-flow rule. Body is otherwise identical to
--      phase-32.
--
--   2. A scoped admins-update-events RLS policy so the admin wizard can write
--      the whole draft (incl. the Phase-35 media fields) in one direct UPDATE,
--      instead of the drift-prone admin_update_event whitelist.
--
-- Additive + idempotent. Reverse #1 by re-running phase-32; reverse #2 by
-- dropping the policy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. organizer_update_event — allow editing published events
-- -----------------------------------------------------------------------------

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

  -- Published is now editable too (was draft/rejected only). In-review events
  -- stay locked until a decision lands.
  if ev_row.status not in ('draft', 'rejected', 'published') then
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

-- -----------------------------------------------------------------------------
-- 2. Admins can UPDATE events directly (for the admin wizard-edit path). The
--    admin insert path already relies on an admin RLS policy; this mirrors it
--    for updates so the wizard can write the full draft in one round trip.
-- -----------------------------------------------------------------------------

drop policy if exists "admins_update_events" on public.events;
create policy "admins_update_events" on public.events
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
