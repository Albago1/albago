-- Phase 17: Organizer verification tiers, instant publish, report safety net
--
-- Adds a 3-tier verification model to organizers, lets the higher tiers skip
-- the admin queue (instant publish), and wires a user-facing event report
-- channel that auto-unverifies repeat offenders.
--
-- Tiers:
--   unverified  — default at signup. Events go through admin queue.
--   established — auto-promoted after 2 admin-approved events in 90 days.
--                 Instant publish, no public badge.
--   verified    — manual ID + phone review by admin. Instant publish + public
--                 checkmark badge + eligible for "Featured".
--
-- Safety:
--   - Weekly event quota (default 10) enforced on creation, even for verified.
--   - Admin can call admin_unverify_organizer() at any time.
--   - 3+ user reports in 7 days auto-drops verified -> unverified.

-- =============================================================================
-- 1. Schema additions on organizers
-- =============================================================================

alter table public.organizers
  add column if not exists verification_tier text
    not null default 'unverified'
    check (verification_tier in ('unverified', 'established', 'verified')),
  add column if not exists verification_tier_at timestamptz default now(),
  add column if not exists phone text,
  add column if not exists id_document_url text,
  add column if not exists id_review_status text
    not null default 'none'
    check (id_review_status in ('none', 'pending', 'approved', 'rejected')),
  add column if not exists id_review_notes text,
  add column if not exists id_reviewed_at timestamptz,
  add column if not exists id_reviewed_by uuid references auth.users(id),
  add column if not exists weekly_event_quota integer not null default 10;

-- Keep the legacy 'verified' boolean in lockstep so existing reads don't break.
-- We mirror verification_tier = 'verified' into it via trigger.
create or replace function public._sync_organizer_verified_flag()
returns trigger
language plpgsql
as $$
begin
  new.verified := (new.verification_tier = 'verified');
  return new;
end;
$$;

drop trigger if exists organizers_sync_verified_flag on public.organizers;
create trigger organizers_sync_verified_flag
  before insert or update of verification_tier on public.organizers
  for each row execute function public._sync_organizer_verified_flag();

-- Backfill: existing rows currently have verified=false and the new tier will
-- be 'unverified', so the boolean already lines up. No-op for safety.
update public.organizers
   set verified = (verification_tier = 'verified')
 where verified is distinct from (verification_tier = 'verified');

-- =============================================================================
-- 2. Reports table
-- =============================================================================

create table if not exists public.organizer_event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in ('spam', 'misleading', 'inappropriate', 'duplicate', 'other')
  ),
  details text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (
    resolution in ('dismissed', 'event_unpublished', 'organizer_unverified')
  ),
  -- one user can only report a given event once
  unique (event_id, reporter_user_id)
);

create index if not exists organizer_event_reports_org_recent_idx
  on public.organizer_event_reports (organizer_id, created_at desc);

alter table public.organizer_event_reports enable row level security;

-- Anyone authenticated can file a report (one per event)
drop policy if exists organizer_event_reports_insert_authenticated
  on public.organizer_event_reports;
create policy organizer_event_reports_insert_authenticated
  on public.organizer_event_reports
  for insert
  to authenticated
  with check (reporter_user_id = auth.uid());

-- Only admins can read reports (no leak to reported orgs)
drop policy if exists organizer_event_reports_select_admin
  on public.organizer_event_reports;
create policy organizer_event_reports_select_admin
  on public.organizer_event_reports
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists organizer_event_reports_update_admin
  on public.organizer_event_reports;
create policy organizer_event_reports_update_admin
  on public.organizer_event_reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- 3. Storage bucket for ID documents
-- =============================================================================

-- Private bucket. Path convention: organizer-verification/{organizer_id}/...
insert into storage.buckets (id, name, public)
  values ('organizer-verification', 'organizer-verification', false)
  on conflict (id) do nothing;

-- Self can read/write only inside their own folder; admin can read all.
drop policy if exists organizer_verification_self_write on storage.objects;
create policy organizer_verification_self_write
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organizer-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists organizer_verification_self_read on storage.objects;
create policy organizer_verification_self_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'organizer-verification'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists organizer_verification_self_delete on storage.objects;
create policy organizer_verification_self_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organizer-verification'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- =============================================================================
-- 4. submit_organizer_verification — organizer self-submits ID + phone
-- =============================================================================

create or replace function public.submit_organizer_verification(
  p_phone text,
  p_id_document_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_phone is null or length(trim(p_phone)) < 5 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  if p_id_document_url is null or length(trim(p_id_document_url)) = 0 then
    raise exception 'missing_id_document' using errcode = '22023';
  end if;

  update public.organizers
     set phone             = p_phone,
         id_document_url   = p_id_document_url,
         id_review_status  = 'pending',
         id_review_notes   = null,
         id_reviewed_at    = null,
         id_reviewed_by    = null,
         updated_at        = now()
   where id = uid;

  if not found then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.submit_organizer_verification(text, text)
  to authenticated;

-- =============================================================================
-- 5. admin_review_organizer_id — admin approves or rejects a submission
-- =============================================================================

create or replace function public.admin_review_organizer_id(
  p_organizer_id uuid,
  p_decision text,             -- 'approved' | 'rejected'
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  update public.organizers
     set id_review_status   = p_decision,
         id_review_notes    = p_notes,
         id_reviewed_at     = now(),
         id_reviewed_by     = uid,
         verification_tier  = case
                                when p_decision = 'approved' then 'verified'
                                else verification_tier
                              end,
         verification_tier_at = case
                                  when p_decision = 'approved' then now()
                                  else verification_tier_at
                                end,
         updated_at         = now()
   where id = p_organizer_id;

  if not found then
    raise exception 'organizer_not_found' using errcode = '02000';
  end if;
end;
$$;

grant execute on function public.admin_review_organizer_id(uuid, text, text)
  to authenticated;

-- =============================================================================
-- 6. admin_unverify_organizer — admin drops an organizer back to unverified
-- =============================================================================

create or replace function public.admin_unverify_organizer(
  p_organizer_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.organizers
     set verification_tier    = 'unverified',
         verification_tier_at = now(),
         id_review_status     = case
                                  when id_review_status = 'approved'
                                  then 'rejected'
                                  else id_review_status
                                end,
         id_review_notes      = coalesce(
                                  trim(both from
                                    coalesce(id_review_notes, '') || E'\nunverified: ' ||
                                    coalesce(p_reason, 'no reason given')
                                  ),
                                  id_review_notes
                                ),
         updated_at           = now()
   where id = p_organizer_id;
end;
$$;

grant execute on function public.admin_unverify_organizer(uuid, text)
  to authenticated;

-- =============================================================================
-- 7. Auto-promote to Established after 2 admin approvals in 90 days
-- =============================================================================

-- Helper: count of currently-published events for an organizer in last 90 days.
create or replace function public._organizer_recent_published_count(p_org uuid)
returns integer
language sql
stable
as $$
  select count(*)::int
    from public.events
   where organizer_id = p_org
     and status = 'published'
     and coalesce(updated_at, created_at) >= now() - interval '90 days'
$$;

-- Fires whenever an event row flips to status='published'. If the organizer
-- is still unverified and now has >= 2 published events in 90 days, promote
-- them to 'established' (instant publish, no public badge).
create or replace function public._maybe_promote_organizer_to_established()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tier text;
  approved_count int;
begin
  if new.status <> 'published' then
    return new;
  end if;
  if new.organizer_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;

  select verification_tier into current_tier
    from public.organizers where id = new.organizer_id;

  if current_tier is null or current_tier <> 'unverified' then
    return new;
  end if;

  approved_count := public._organizer_recent_published_count(new.organizer_id);

  if approved_count >= 2 then
    update public.organizers
       set verification_tier    = 'established',
           verification_tier_at = now(),
           updated_at           = now()
     where id = new.organizer_id
       and verification_tier = 'unverified';
  end if;

  return new;
end;
$$;

drop trigger if exists events_maybe_promote_organizer on public.events;
create trigger events_maybe_promote_organizer
  after insert or update of status on public.events
  for each row execute function public._maybe_promote_organizer_to_established();

-- =============================================================================
-- 8. Updated organizer_create_event_v2 — instant publish for non-unverified
--    tiers + weekly rate limit
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
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into org_row from public.organizers where id = uid;
  if not found then
    raise exception 'not_organizer' using errcode = '42501';
  end if;

  -- Weekly rate limit (applies to every tier, including verified)
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

  insert into public.events (
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
    input->>'banner_url',
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
-- 9. report_event — user-facing report channel + auto-unverify after 3 in 7d
-- =============================================================================

create or replace function public.report_event(
  p_event_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid              uuid := auth.uid();
  event_org_id     uuid;
  recent_report_count integer;
  new_report_id    uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_reason not in ('spam', 'misleading', 'inappropriate', 'duplicate', 'other') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;

  select organizer_id into event_org_id from public.events where id = p_event_id;
  if event_org_id is null then
    raise exception 'event_has_no_organizer' using errcode = '02000';
  end if;

  insert into public.organizer_event_reports (
    event_id, organizer_id, reporter_user_id, reason, details
  ) values (
    p_event_id, event_org_id, uid, p_reason, p_details
  )
  on conflict (event_id, reporter_user_id) do nothing
  returning id into new_report_id;

  -- Auto-unverify a verified organizer who accumulates 3+ unresolved reports
  -- in any 7-day window. Established + unverified tiers are unaffected.
  select count(*) into recent_report_count
    from public.organizer_event_reports
   where organizer_id = event_org_id
     and resolved_at is null
     and created_at >= now() - interval '7 days';

  if recent_report_count >= 3 then
    update public.organizers
       set verification_tier    = 'unverified',
           verification_tier_at = now(),
           id_review_notes      = trim(both from
             coalesce(id_review_notes, '') ||
             E'\nauto-unverified: ' || recent_report_count || ' user reports in 7 days'),
           updated_at           = now()
     where id = event_org_id
       and verification_tier = 'verified';
  end if;

  return new_report_id;
end;
$$;

grant execute on function public.report_event(uuid, text, text) to authenticated;
