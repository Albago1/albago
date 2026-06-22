-- =============================================================================
-- Phase 23 — Pankartat as a photo gallery
-- =============================================================================
-- Pivots /pankartat from a curated slogan library into a community photo wall:
-- users upload a phone photo of their real placard at a protest. The optional
-- "caption" replaces "slogan" as the primary text — but legacy slogan rows
-- still validate so we don't break Phase 20 data while we transition.
--
-- Changes on public.placards:
--   * add image_url text (the uploaded photo URL in storage)
--   * add caption    text (what's written on the placard / commentary)
--   * slogan         → nullable (legacy column, optional for new rows)
--   * drop unique-slogan index (two photos can carry the same caption)
--   * add row-level CHECK so at least one of (image_url, slogan) is present
--   * rewrite placards_insert_self policy to allow either text- or photo-based
--     submissions
--
-- New storage bucket: placard-photos (mirrors the event-covers pattern from
-- phase-13-storage.sql).
--
-- Idempotent — safe to re-run.
-- =============================================================================

----------------------------------------------------------------------------
-- 1. Schema changes
----------------------------------------------------------------------------

alter table public.placards
  add column if not exists image_url text,
  add column if not exists caption   text;

alter table public.placards
  alter column slogan drop not null;

drop index if exists placards_slogan_unique;

alter table public.placards
  drop constraint if exists placards_content_present;

alter table public.placards
  add constraint placards_content_present
  check (image_url is not null or slogan is not null);

create index if not exists placards_image_url_idx
  on public.placards ((image_url is not null));

----------------------------------------------------------------------------
-- 2. Rewrite insert policy — allow photo OR text submissions
----------------------------------------------------------------------------

drop policy if exists "placards_insert_self" on public.placards;
create policy "placards_insert_self" on public.placards
  for insert to authenticated
  with check (
    auth.uid() = submitted_by
    and status = 'pending'
    and (
      -- photo submission: any caption length, image_url must be present
      image_url is not null
      or
      -- legacy text submission: enforce the old 3..140 char range on slogan
      char_length(trim(slogan)) between 3 and 140
    )
  );

----------------------------------------------------------------------------
-- 3. Storage bucket for placard photos
----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('placard-photos', 'placard-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "placard_photos_select_public" on storage.objects;
create policy "placard_photos_select_public"
  on storage.objects for select
  using (bucket_id = 'placard-photos');

drop policy if exists "placard_photos_insert_authenticated" on storage.objects;
create policy "placard_photos_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'placard-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "placard_photos_update_owner" on storage.objects;
create policy "placard_photos_update_owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'placard-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "placard_photos_delete_owner" on storage.objects;
create policy "placard_photos_delete_owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'placard-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
