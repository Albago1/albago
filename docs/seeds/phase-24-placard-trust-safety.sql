-- =============================================================================
-- Phase 24 — Placard trust & safety: rate limits + community reports
-- =============================================================================
-- Two things in one block:
--
-- 1. A SECURITY DEFINER RPC `submit_placard_photo` that enforces a per-user
--    rate limit (5 photos / hour, 20 / day) before inserting into placards.
--    Direct INSERT permission is then revoked from the `authenticated` role
--    so the RPC is the only writable path. Anonymous users are unaffected
--    (they can't insert today and still can't).
--
-- 2. A `placard_reports` table with composite PK (reporter_id, placard_id)
--    so a single user can report a single placard at most once. The
--    denormalized `report_count` column on placards is kept in sync by
--    triggers on insert/delete (same shape as the existing vote_count).
--
-- Idempotent — safe to re-run.
-- =============================================================================

----------------------------------------------------------------------------
-- 1. Add denormalized report_count to placards
----------------------------------------------------------------------------

alter table public.placards
  add column if not exists report_count integer not null default 0;

create index if not exists placards_report_count_idx
  on public.placards (report_count desc) where report_count > 0;

----------------------------------------------------------------------------
-- 2. placard_reports table
----------------------------------------------------------------------------

create table if not exists public.placard_reports (
  reporter_id uuid not null references auth.users(id) on delete cascade,
  placard_id  uuid not null references public.placards(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (reporter_id, placard_id)
);

create index if not exists placard_reports_placard_idx
  on public.placard_reports (placard_id);

alter table public.placard_reports enable row level security;

-- Self-insert only (and only your own user_id).
drop policy if exists "placard_reports_insert_self" on public.placard_reports;
create policy "placard_reports_insert_self" on public.placard_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

-- You can see / withdraw your own reports.
drop policy if exists "placard_reports_select_own" on public.placard_reports;
create policy "placard_reports_select_own" on public.placard_reports
  for select to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "placard_reports_delete_own" on public.placard_reports;
create policy "placard_reports_delete_own" on public.placard_reports
  for delete to authenticated
  using (auth.uid() = reporter_id);

-- Admins can see every report (for the moderation queue).
drop policy if exists "placard_reports_select_admin" on public.placard_reports;
create policy "placard_reports_select_admin" on public.placard_reports
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

----------------------------------------------------------------------------
-- 3. Report-count triggers (mirror the vote_count pattern)
----------------------------------------------------------------------------

create or replace function public.placard_report_count_inc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.placards
    set report_count = report_count + 1,
        updated_at = now()
    where id = new.placard_id;
  return new;
end;
$$;

create or replace function public.placard_report_count_dec()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.placards
    set report_count = greatest(report_count - 1, 0),
        updated_at = now()
    where id = old.placard_id;
  return old;
end;
$$;

drop trigger if exists placard_report_inc on public.placard_reports;
create trigger placard_report_inc
  after insert on public.placard_reports
  for each row execute function public.placard_report_count_inc();

drop trigger if exists placard_report_dec on public.placard_reports;
create trigger placard_report_dec
  after delete on public.placard_reports
  for each row execute function public.placard_report_count_dec();

----------------------------------------------------------------------------
-- 4. Rate-limited submission RPC
----------------------------------------------------------------------------
-- Limits are tuned for a community gallery, not a Twitter clone:
--   5 photos / rolling hour, 20 / rolling day per authenticated user.
-- The function raises a Postgres exception with a readable message that the
-- client surfaces to the user. Admins are exempt — useful for backfilling
-- or fixing bad rows.

create or replace function public.submit_placard_photo(
  p_image_url       text,
  p_caption         text default null,
  p_slogan          text default null,
  p_language        text default 'sq',
  p_city            text default null,
  p_submitter_name  text default null
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
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_image_url is null or length(trim(p_image_url)) = 0 then
    raise exception 'image_url is required';
  end if;

  if p_language is null or p_language not in ('sq', 'en', 'de') then
    raise exception 'Invalid language: %', p_language;
  end if;

  -- Admins skip the rate limit (useful for backfills + emergency uploads).
  select role into caller_role
    from public.profiles
    where id = caller_id;

  if coalesce(caller_role, '') <> 'admin' then
    select count(*) into hour_count
      from public.placards
      where submitted_by = caller_id
        and created_at >= now() - interval '1 hour';

    if hour_count >= 5 then
      raise exception 'Rate limit: max 5 placards per hour. Try again later.';
    end if;

    select count(*) into day_count
      from public.placards
      where submitted_by = caller_id
        and created_at >= now() - interval '24 hours';

    if day_count >= 20 then
      raise exception 'Rate limit: max 20 placards per day. Try again tomorrow.';
    end if;
  end if;

  insert into public.placards (
    image_url, caption, slogan, language, city, status,
    submitted_by, submitter_name, categories
  )
  values (
    trim(p_image_url),
    nullif(trim(coalesce(p_caption, '')), ''),
    nullif(trim(coalesce(p_slogan, '')), ''),
    p_language,
    nullif(trim(coalesce(p_city, '')), ''),
    'pending',
    caller_id,
    nullif(trim(coalesce(p_submitter_name, '')), ''),
    '{}'::text[]
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.submit_placard_photo(
  text, text, text, text, text, text
) to authenticated;

----------------------------------------------------------------------------
-- 5. Lock down direct INSERT — RPC is the only path
----------------------------------------------------------------------------
-- The Phase 20 `placards_insert_self` policy stays in the catalog for legacy
-- text-only submissions (image_url null + slogan present). We narrow it so
-- it only allows the legacy text path; photo submissions must use the RPC,
-- which means they pass through the rate limit and validation.

drop policy if exists "placards_insert_self" on public.placards;
create policy "placards_insert_self" on public.placards
  for insert to authenticated
  with check (
    auth.uid() = submitted_by
    and status = 'pending'
    and image_url is null
    and char_length(trim(slogan)) between 3 and 140
  );
