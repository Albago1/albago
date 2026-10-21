-- Engine settings (key → JSON value), edited from /admin/engine.
-- First setting: `expiry` — remove pending suggestions once their event has
-- ended ({ "enabled": true, "grace_days": 0 }). Same lock-down as every other
-- engine table: RLS on, no policies, service role only.

create table if not exists engine.settings (
  key         text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table engine.settings enable row level security;
revoke all on engine.settings from public, anon, authenticated;
grant select, insert, update, delete on engine.settings to service_role;
