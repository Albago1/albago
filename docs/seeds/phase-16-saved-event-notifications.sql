-- Phase 16: Saved-event change notifications
--
-- Adds notification_preferences JSONB to profiles so users can opt out of
-- email alerts when an event they've saved gets updated (date/time/address
-- changes, cancellations). Default preserves the most useful subscription
-- on; existing rows get backfilled so legacy users get the same behaviour.
--
-- This migration is application-layer only — the actual fanout happens in
-- the Vercel route /api/notifications/event-changed, triggered by a
-- Supabase Database Webhook on UPDATE events. Webhook setup is documented
-- in docs/notifications.md (manual step in Supabase Studio).

-- 1. New column with sensible default
alter table public.profiles
  add column if not exists notification_preferences jsonb
    not null
    default jsonb_build_object('saved_event_updates', true);

-- 2. Backfill any pre-existing rows whose column was added before the default
--    fired (idempotent — no-ops if the JSONB already has the key)
update public.profiles
   set notification_preferences =
       coalesce(notification_preferences, '{}'::jsonb)
       || jsonb_build_object('saved_event_updates', true)
 where notification_preferences is null
    or not (notification_preferences ? 'saved_event_updates');

-- 3. Self-serve RLS for preferences (read + update own row only).
--    Profile rows are created by an existing auth-signup trigger; we don't
--    need INSERT or DELETE policies here.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'profiles'
       and policyname = 'profiles_update_own_preferences'
  ) then
    create policy profiles_update_own_preferences
      on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end$$;
