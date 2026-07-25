-- =============================================================================
-- Phase 34 — User avatars: profiles.avatar_url + public `avatars` bucket
-- =============================================================================
-- Adds a self-serve profile photo. Mirrors the event-covers storage pattern
-- (phase-13): a public bucket with owner-folder RLS so a user can only write
-- into a folder named after their own UID.
--
--   * SELECT  → public (avatars appear in the navbar / on public profiles)
--   * INSERT  → authenticated users, into a folder named after their UID
--   * UPDATE  → owner only
--   * DELETE  → owner only
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1. Column on profiles (nullable; NULL = fall back to the initial letter)
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Public bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Public read
drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated insert into own UID folder
drop policy if exists "avatars_insert_authenticated" on storage.objects;
create policy "avatars_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can update their own files
drop policy if exists "avatars_update_owner" on storage.objects;
create policy "avatars_update_owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own files
drop policy if exists "avatars_delete_owner" on storage.objects;
create policy "avatars_delete_owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verify
select id, public from storage.buckets where id = 'avatars';
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name = 'avatar_url';
