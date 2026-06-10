-- =============================================================================
-- Phase 13 (D5) — Storage bucket for event cover images
-- =============================================================================
-- Creates the public `event-covers` bucket used by the new event creation
-- wizard (MediaStep) and a small set of RLS policies on storage.objects:
--
--   * SELECT  → public (covers ship inside published events)
--   * INSERT  → authenticated users, into a folder named after their UID
--   * UPDATE  → owner only
--   * DELETE  → owner only
--
-- Anonymous community submissions can still go through; they just submit
-- without a cover and the moderator (or the same user once logged in) can add
-- one later. This avoids opening an unauthenticated upload surface.
--
-- Idempotent — safe to re-run.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do update set public = excluded.public;

-- Public read
drop policy if exists "event_covers_select_public" on storage.objects;
create policy "event_covers_select_public"
  on storage.objects for select
  using (bucket_id = 'event-covers');

-- Authenticated insert into own UID folder
drop policy if exists "event_covers_insert_authenticated" on storage.objects;
create policy "event_covers_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can update their own files
drop policy if exists "event_covers_update_owner" on storage.objects;
create policy "event_covers_update_owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own files
drop policy if exists "event_covers_delete_owner" on storage.objects;
create policy "event_covers_delete_owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verify
select id, public from storage.buckets where id = 'event-covers';
