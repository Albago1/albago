-- Phase 20 — Placard library (Pankartat e Revolucionit)
--
-- Adds a curated protest-slogan library with community voting and submission
-- moderation. /pankartat reads approved rows from public.placards; community
-- submissions land with status='pending' and require admin approval.
--
-- Tables:
--   placards          — slogans (status: pending / approved / rejected)
--   placard_votes     — one row per (user, placard) — used for "🔥 Voto"
--
-- Maintenance:
--   placards.vote_count is a denormalized integer kept in sync by triggers on
--   placard_votes so "most popular" sorting stays a plain ORDER BY.
--
-- Admin moderation:
--   admin_moderate_placard(uuid, text, text) — SECURITY DEFINER, checks
--   public.profiles.role = 'admin'. Sets status + admin_note + approved_at.
--
-- Apply order: paste this whole file in Supabase Studio → SQL Editor.

----------------------------------------------------------------------------
-- Tables
----------------------------------------------------------------------------

create table if not exists public.placards (
  id uuid primary key default gen_random_uuid(),
  slogan text not null,
  language text not null check (language in ('sq', 'en', 'de')),
  categories text[] not null default '{}',
  city text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  vote_count integer not null default 0,
  submitted_by uuid references auth.users(id) on delete set null,
  submitter_name text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null
);

-- Case-insensitive uniqueness to block accidental duplicates regardless of
-- casing differences.
create unique index if not exists placards_slogan_unique
  on public.placards (lower(trim(slogan)));

create index if not exists placards_status_created_idx
  on public.placards (status, created_at desc);

create index if not exists placards_status_votes_idx
  on public.placards (status, vote_count desc);

create index if not exists placards_language_idx
  on public.placards (language);

create table if not exists public.placard_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  placard_id uuid not null references public.placards(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, placard_id)
);

create index if not exists placard_votes_placard_idx
  on public.placard_votes (placard_id);

----------------------------------------------------------------------------
-- RLS
----------------------------------------------------------------------------

alter table public.placards enable row level security;
alter table public.placard_votes enable row level security;

drop policy if exists "placards_select_approved" on public.placards;
create policy "placards_select_approved" on public.placards
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists "placards_select_own" on public.placards;
create policy "placards_select_own" on public.placards
  for select to authenticated
  using (submitted_by = auth.uid());

drop policy if exists "placards_select_admin" on public.placards;
create policy "placards_select_admin" on public.placards
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "placards_insert_self" on public.placards;
create policy "placards_insert_self" on public.placards
  for insert to authenticated
  with check (
    auth.uid() = submitted_by
    and status = 'pending'
    and char_length(trim(slogan)) between 3 and 140
  );

-- Votes
drop policy if exists "placard_votes_select_all" on public.placard_votes;
create policy "placard_votes_select_all" on public.placard_votes
  for select to anon, authenticated
  using (true);

drop policy if exists "placard_votes_insert_self" on public.placard_votes;
create policy "placard_votes_insert_self" on public.placard_votes
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "placard_votes_delete_self" on public.placard_votes;
create policy "placard_votes_delete_self" on public.placard_votes
  for delete to authenticated
  using (auth.uid() = user_id);

----------------------------------------------------------------------------
-- Vote-count triggers
----------------------------------------------------------------------------

create or replace function public.placard_vote_count_inc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.placards
    set vote_count = vote_count + 1,
        updated_at = now()
    where id = new.placard_id;
  return new;
end;
$$;

create or replace function public.placard_vote_count_dec()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.placards
    set vote_count = greatest(vote_count - 1, 0),
        updated_at = now()
    where id = old.placard_id;
  return old;
end;
$$;

drop trigger if exists placard_vote_inc on public.placard_votes;
create trigger placard_vote_inc
  after insert on public.placard_votes
  for each row execute function public.placard_vote_count_inc();

drop trigger if exists placard_vote_dec on public.placard_votes;
create trigger placard_vote_dec
  after delete on public.placard_votes
  for each row execute function public.placard_vote_count_dec();

----------------------------------------------------------------------------
-- Admin moderation RPC
----------------------------------------------------------------------------

create or replace function public.admin_moderate_placard(
  placard_id uuid,
  new_status text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select role into caller_role
    from public.profiles
    where id = auth.uid();

  if caller_role <> 'admin' then
    raise exception 'Not authorized';
  end if;

  if new_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Invalid status: %', new_status;
  end if;

  update public.placards
    set status = new_status,
        admin_note = coalesce(note, admin_note),
        approved_at = case when new_status = 'approved' then now() else approved_at end,
        approved_by = case when new_status = 'approved' then auth.uid() else approved_by end,
        updated_at = now()
    where id = placard_id;
end;
$$;

grant execute on function public.admin_moderate_placard(uuid, text, text) to authenticated;

----------------------------------------------------------------------------
-- Seed (15 starter slogans matching lib/placards.ts SEED_PLACARDS)
----------------------------------------------------------------------------

insert into public.placards (slogan, language, categories, status, approved_at)
values
  ('Shqipëria nuk shitet',              'sq', '{flamingo-revolution,korrupsioni,short,powerful}', 'approved', now()),
  ('Vjosa nuk shitet',                  'sq', '{vjosa-narta,short,powerful}',                      'approved', now()),
  ('Narta nuk është biznes',            'sq', '{vjosa-narta,short}',                               'approved', now()),
  ('Mbroni flamingot',                  'sq', '{flamingo-revolution,vjosa-narta,short}',           'approved', now()),
  ('Jo beton në zonat e mbrojtura',     'sq', '{vjosa-narta,korrupsioni}',                         'approved', now()),
  ('Flamingot nuk kanë zë, ne po',      'sq', '{flamingo-revolution,vjosa-narta,powerful}',        'approved', now()),
  ('Për Shqipërinë, jo për oligarkët',  'sq', '{korrupsioni,powerful}',                            'approved', now()),
  ('Nature is not for sale',            'en', '{vjosa-narta,short,powerful}',                      'approved', now()),
  ('Protect Vjosa-Narta',               'en', '{vjosa-narta,short}',                               'approved', now()),
  ('Albania is not for sale',           'en', '{flamingo-revolution,korrupsioni,short,powerful}',  'approved', now()),
  ('Keine Betonierung geschützter Natur','de','{vjosa-narta,korrupsioni}',                         'approved', now()),
  ('Schutz für Vjosa-Narta',            'de', '{vjosa-narta,short}',                               'approved', now()),
  ('Diaspora për Shqipërinë',           'sq', '{diaspora,short}',                                  'approved', now()),
  ('Një zë për natyrën',                'sq', '{vjosa-narta,short}',                               'approved', now()),
  ('Stop shkatërrimit të natyrës',      'sq', '{vjosa-narta,powerful}',                            'approved', now())
on conflict do nothing;
