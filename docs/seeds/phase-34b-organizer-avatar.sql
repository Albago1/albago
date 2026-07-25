-- =============================================================================
-- Phase 34b — Public organizer avatar accessor
-- =============================================================================
-- The public organizer profile page reuses the owner's account avatar
-- (organizers.id === the owner's profiles.id). `profiles` is NOT publicly
-- readable, and RLS is row-level (a public SELECT policy would expose every
-- column). This SECURITY DEFINER function exposes ONLY avatar_url, and only
-- for ids that are actually organizers — nothing else in profiles leaks.
--
-- avatar_url is already a public storage URL (the `avatars` bucket is public),
-- so returning it to anon is safe.
--
-- Idempotent — safe to re-run.
-- =============================================================================

create or replace function public.organizer_avatar_url(p_organizer_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.avatar_url
  from public.profiles p
  join public.organizers o on o.id = p.id
  where p.id = p_organizer_id
$$;

grant execute on function public.organizer_avatar_url(uuid) to anon, authenticated;

-- Verify — returns the avatar URL (or NULL) for a known organizer id:
-- select public.organizer_avatar_url('<some-organizer-uuid>');
