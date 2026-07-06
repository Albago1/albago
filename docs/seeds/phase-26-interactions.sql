-- Phase 26 — interaction analytics foundation
-- One append-only table for first-party, PII-free usage tracking.
-- Writes happen exclusively through /api/track (service role, bypasses RLS);
-- there are deliberately NO insert policies, so anon/authenticated sessions
-- cannot write rows directly via PostgREST.

begin;

create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in (
    'event_view', 'protest_view', 'place_view', 'placard_view',
    'placard_download', 'share_click', 'city_search', 'search_query',
    'submit_started', 'submit_completed',
    'calendar_add', 'subscribe', 'outbound_click'
  )),
  entity_type text check (entity_type in ('event', 'place', 'placard', 'submission')),
  entity_id   uuid,
  city        text,
  country     text,
  platform    text,
  source      text,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  path        text,
  referrer    text,
  session_id  uuid not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists interactions_type_created_idx
  on public.interactions (type, created_at desc);
create index if not exists interactions_entity_idx
  on public.interactions (entity_type, entity_id, created_at desc);
create index if not exists interactions_session_idx
  on public.interactions (session_id, created_at desc);

alter table public.interactions enable row level security;

-- Reads: admins only (future admin surface; Studio queries use the service role anyway).
create policy interactions_select_admin on public.interactions
  for select using (is_admin());

commit;

-- ---------------------------------------------------------------------------
-- Handy queries (run in Studio; not part of the migration):
--
-- The 5 daily numbers:
--   select count(distinct session_id) from interactions where created_at > now() - interval '1 day';
--   select count(*) from interactions where type in ('event_view','protest_view') and created_at > now() - interval '1 day';
--   select metadata->>'q' as q, count(*) from interactions where type = 'search_query' and created_at > now() - interval '7 days' group by 1 order by 2 desc limit 10;
--   select utm_source, count(distinct session_id) from interactions where utm_source is not null and created_at > now() - interval '7 days' group by 1 order by 2 desc;
--   select type, count(*) from interactions where created_at > now() - interval '1 day' group by 1 order by 2 desc;
--
-- Returning sessions (seen on 2+ distinct days in the last 14):
--   select count(*) from (
--     select session_id from interactions
--     where created_at > now() - interval '14 days'
--     group by session_id having count(distinct created_at::date) >= 2
--   ) s;
