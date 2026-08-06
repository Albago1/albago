-- =============================================================================
-- Phase 35 — Named photo sections + independent cover
-- =============================================================================
-- Two additions to how an event carries photos:
--
--   1. cover_in_gallery (boolean, default true) — when false, the public page
--      stops repeating the cover (gallery_urls[0]) inside the gallery deck; the
--      cover then lives only in the hero. Default true preserves the old look.
--
--   2. content_sections (jsonb array, default []) — optional named photo
--      sections rendered as their own bands below the main gallery, each with
--      { "title", "body", "urls": [] } (e.g. "The Venue", "Lineup").
--
-- These are ADDITIVE and set by two NEW, self-contained RPCs — the fragile
-- organizer_create_event_v2 / organizer_update_event / submit_event_submission
-- functions are deliberately left untouched. The app calls set_event_media /
-- set_submission_media right after the row exists (fail-soft, like ticket
-- tiers), so a media-save hiccup never blocks event creation.
--
-- Idempotent + reversible — safe to re-run. Reverse by dropping the two
-- functions and the four columns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Schema additions
-- -----------------------------------------------------------------------------

alter table public.events
  add column if not exists cover_in_gallery boolean not null default true;
alter table public.events
  add column if not exists content_sections jsonb not null default '[]'::jsonb;

alter table public.event_submissions
  add column if not exists cover_in_gallery boolean not null default true;
alter table public.event_submissions
  add column if not exists content_sections jsonb not null default '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 2. Shared normaliser — rebuild an incoming sections array from known keys
--    only, cap the text fields, and drop sections that carry nothing. This is
--    the single source of truth both media RPCs call, so a client can never
--    stuff arbitrary jsonb onto a row.
-- -----------------------------------------------------------------------------

create or replace function public._normalize_media_sections(p_sections jsonb)
returns jsonb
language sql
immutable
as $norm$
  select coalesce(
    jsonb_agg(section order by ord)
      filter (
        where length(section->>'title') > 0
           or length(section->>'body') > 0
           or jsonb_array_length(section->'urls') > 0
      ),
    '[]'::jsonb
  )
  from (
    select
      ord,
      jsonb_build_object(
        'title', left(coalesce(trim(elem->>'title'), ''), 120),
        'body',  left(coalesce(trim(elem->>'body'), ''), 2000),
        'urls',  coalesce((
          select jsonb_agg(u)
          from jsonb_array_elements_text(
            case when jsonb_typeof(elem->'urls') = 'array'
                 then elem->'urls' else '[]'::jsonb end
          ) u
          where length(u) > 0
        ), '[]'::jsonb)
      ) as section
    from jsonb_array_elements(
      case when jsonb_typeof(p_sections) = 'array' then p_sections else '[]'::jsonb end
    ) with ordinality as t(elem, ord)
  ) normalized;
$norm$;

-- -----------------------------------------------------------------------------
-- 3. set_event_media — owner-or-admin writes the two media fields on an event.
--    Called after organizer_create_event_v2 / organizer_update_event return an
--    id (and by the admin wizard path). Kept tiny on purpose.
-- -----------------------------------------------------------------------------

create or replace function public.set_event_media(
  p_event_id uuid,
  p_sections jsonb,
  p_cover_in_gallery boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $sem$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.events e set
    content_sections = public._normalize_media_sections(p_sections),
    cover_in_gallery = coalesce(p_cover_in_gallery, true),
    updated_at       = now()
  where e.id = p_event_id
    and (e.organizer_id = uid or public.is_admin());

  if not found then
    raise exception 'not_found_or_not_owner';
  end if;
end;
$sem$;

grant execute on function public.set_event_media(uuid, jsonb, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. set_submission_media — same idea for a pending community submission. The
--    submitter owns the row (or an admin acts on it); the fields ride along to
--    the events row when the submission is approved.
-- -----------------------------------------------------------------------------

create or replace function public.set_submission_media(
  p_submission_id uuid,
  p_sections jsonb,
  p_cover_in_gallery boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $ssm$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.event_submissions s set
    content_sections = public._normalize_media_sections(p_sections),
    cover_in_gallery = coalesce(p_cover_in_gallery, true)
  where s.id = p_submission_id
    and (s.submitted_by_user_id = uid or public.is_admin());

  if not found then
    raise exception 'not_found_or_not_owner';
  end if;
end;
$ssm$;

grant execute on function public.set_submission_media(uuid, jsonb, boolean) to authenticated;
